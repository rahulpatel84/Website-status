// Individual layer probes used by the monitor engine.
// Each probe returns a strictly-typed result so callers can differentiate
// between low-level network failures (DNS/TCP/TLS) and application errors
// (HTTP status, body assertions).
//
// All timings are in milliseconds.
//
// Only Node built-ins + the global `fetch` (backed by undici in Node 18+/
// Next.js 14) are used. Do not add heavyweight deps here.

import { promises as dnsPromises } from "node:dns"
import net from "node:net"
import tls from "node:tls"
import { performance } from "node:perf_hooks"
import { logEvent } from "@/lib/logs"

// --------------------------------------------------------------------
// Types
// --------------------------------------------------------------------

export interface DnsResult {
  ok: boolean
  ms: number
  error?: string
  addresses?: string[]
}

export interface TcpResult {
  ok: boolean
  ms: number
  error?: string
}

export interface TlsCertInfo {
  validTo: string
  daysUntilExpiry: number
}

export interface TlsResult {
  ok: boolean
  ms: number
  error?: string
  cert?: TlsCertInfo
}

export interface HttpHeadResult {
  ok: boolean
  ms: number
  status?: number
  error?: string
}

export interface HttpGetResult {
  ok: boolean
  ms: number
  status?: number
  body?: string
  headers?: Record<string, string>
  error?: string
}

export interface SslCertResult {
  ok: boolean
  daysUntilExpiry?: number
  validTo?: string
  error?: string
}

// --------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------

function now(): number {
  return performance.now()
}

function ms(start: number): number {
  return Math.max(0, Math.round(performance.now() - start))
}

// Monitor targets are user-supplied and can carry credentials or API keys in
// the userinfo/query portion of a URL. Strip both before anything is logged.
function redactTarget(target: string): string {
  try {
    const u = new URL(target)
    u.username = ""
    u.password = ""
    if (u.search) u.search = "?redacted"
    return u.toString()
  } catch {
    return target
  }
}

// Fire-and-forget probe outcome log. Successful probes stay at "debug" so a
// healthy fleet does not flood the event log; only failures surface at "warn".
function logProbe(
  layer: string,
  target: string,
  result: { ok: boolean; ms: number; error?: string },
  extra?: Record<string, unknown>,
): void {
  const safeTarget = redactTarget(target)
  logEvent({
    level: result.ok ? "debug" : "warn",
    source: "monitor",
    event: result.ok ? "monitor.probe_ok" : "monitor.probe_failed",
    message: result.ok
      ? `${layer} probe ok for ${safeTarget}`
      : `${layer} probe failed for ${safeTarget}: ${result.error ?? "unknown error"}`,
    targetType: "probe_target",
    targetId: safeTarget,
    durationMs: result.ms,
    metadata: {
      layer,
      ...(result.error ? { error: result.error } : {}),
      ...(extra ?? {}),
    },
  })
}

function errString(e: unknown): string {
  if (e instanceof Error) return e.message
  try {
    return String(e)
  } catch {
    return "unknown error"
  }
}

// --------------------------------------------------------------------
// DNS
// --------------------------------------------------------------------

export async function dnsResolve(host: string): Promise<DnsResult> {
  const start = now()
  try {
    const addresses = await dnsPromises.resolve4(host)
    const result: DnsResult = { ok: true, ms: ms(start), addresses }
    logProbe("dns", host, result, { addressCount: addresses.length })
    return result
  } catch (e) {
    const result: DnsResult = { ok: false, ms: ms(start), error: errString(e) }
    logProbe("dns", host, result)
    return result
  }
}

// --------------------------------------------------------------------
// TCP
// --------------------------------------------------------------------

export function tcpConnect(
  host: string,
  port: number,
  timeout = 5000,
): Promise<TcpResult> {
  return new Promise((resolve) => {
    const start = now()
    let settled = false
    const socket = new net.Socket()

    const done = (result: TcpResult) => {
      if (settled) return
      settled = true
      logProbe("tcp", `${host}:${port}`, result, { port })
      try {
        socket.destroy()
      } catch {
        // ignore
      }
      resolve(result)
    }

    socket.setTimeout(timeout)

    socket.once("connect", () => {
      done({ ok: true, ms: ms(start) })
    })

    socket.once("timeout", () => {
      done({ ok: false, ms: ms(start), error: `tcp timeout after ${timeout}ms` })
    })

    socket.once("error", (err) => {
      done({ ok: false, ms: ms(start), error: errString(err) })
    })

    try {
      socket.connect(port, host)
    } catch (e) {
      done({ ok: false, ms: ms(start), error: errString(e) })
    }
  })
}

// --------------------------------------------------------------------
// TLS
// --------------------------------------------------------------------

export function tlsHandshake(
  host: string,
  port: number,
  timeout = 5000,
): Promise<TlsResult> {
  return new Promise((resolve) => {
    const start = now()
    let settled = false

    const done = (result: TlsResult) => {
      if (settled) return
      settled = true
      logProbe("tls", `${host}:${port}`, result, {
        port,
        ...(result.cert ? { daysUntilExpiry: result.cert.daysUntilExpiry } : {}),
      })
      try {
        socket.destroy()
      } catch {
        // ignore
      }
      resolve(result)
    }

    const socket = tls.connect({
      host,
      port,
      servername: host,
      // Keep default cert validation; monitors want to know when TLS is bad.
      rejectUnauthorized: true,
    })

    const timer = setTimeout(() => {
      done({ ok: false, ms: ms(start), error: `tls timeout after ${timeout}ms` })
    }, timeout)

    socket.once("secureConnect", () => {
      clearTimeout(timer)
      try {
        const peerCert = socket.getPeerCertificate()
        let cert: TlsCertInfo | undefined
        if (peerCert && peerCert.valid_to) {
          const validTo = new Date(peerCert.valid_to)
          const daysUntilExpiry = Math.floor(
            (validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          )
          cert = { validTo: validTo.toISOString(), daysUntilExpiry }
        }
        done({ ok: true, ms: ms(start), cert })
      } catch (e) {
        done({ ok: false, ms: ms(start), error: errString(e) })
      }
    })

    socket.once("error", (err) => {
      clearTimeout(timer)
      done({ ok: false, ms: ms(start), error: errString(err) })
    })
  })
}

// --------------------------------------------------------------------
// HTTP
// --------------------------------------------------------------------

const MAX_BODY_BYTES = 4 * 1024 // 4KB

async function readTruncatedBody(res: Response): Promise<string> {
  // Read up to MAX_BODY_BYTES from the response body.
  const reader = res.body?.getReader()
  if (!reader) {
    // No stream — fall back to text() and truncate.
    const text = await res.text().catch(() => "")
    return text.length > MAX_BODY_BYTES ? text.slice(0, MAX_BODY_BYTES) : text
  }
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < MAX_BODY_BYTES) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value) continue
      const remaining = MAX_BODY_BYTES - total
      if (value.byteLength > remaining) {
        chunks.push(value.slice(0, remaining))
        total += remaining
        break
      }
      chunks.push(value)
      total += value.byteLength
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      // ignore
    }
  }
  const buf = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    buf.set(c, offset)
    offset += c.byteLength
  }
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(buf)
  } catch {
    return ""
  }
}

export async function httpHead(
  url: string,
  timeout = 10000,
): Promise<HttpHeadResult> {
  const start = now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    })
    const result: HttpHeadResult = { ok: res.ok, ms: ms(start), status: res.status }
    logProbe("http", url, result, { method: "HEAD", status: res.status })
    return result
  } catch (e) {
    const err = errString(e)
    const result: HttpHeadResult = {
      ok: false,
      ms: ms(start),
      error: controller.signal.aborted ? `http timeout after ${timeout}ms` : err,
    }
    logProbe("http", url, result, { method: "HEAD" })
    return result
  } finally {
    clearTimeout(timer)
  }
}

export async function httpGet(
  url: string,
  method: string,
  timeout = 10000,
): Promise<HttpGetResult> {
  const start = now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      method: method.toUpperCase(),
      signal: controller.signal,
      redirect: "follow",
    })
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v
    })
    let body: string | undefined
    if (method.toUpperCase() !== "HEAD") {
      body = await readTruncatedBody(res)
    }
    const result: HttpGetResult = {
      ok: res.ok,
      ms: ms(start),
      status: res.status,
      body,
      headers,
    }
    // Never log `body` or `headers` — they can contain session tokens.
    logProbe("http", url, result, {
      method: method.toUpperCase(),
      status: res.status,
      bodyBytes: body?.length ?? 0,
    })
    return result
  } catch (e) {
    const result: HttpGetResult = {
      ok: false,
      ms: ms(start),
      error: controller.signal.aborted ? `http timeout after ${timeout}ms` : errString(e),
    }
    logProbe("http", url, result, { method: method.toUpperCase() })
    return result
  } finally {
    clearTimeout(timer)
  }
}

// --------------------------------------------------------------------
// SSL Cert convenience
// --------------------------------------------------------------------

export async function sslCert(host: string, port = 443): Promise<SslCertResult> {
  const result = await tlsHandshake(host, port)
  if (!result.ok) {
    return { ok: false, error: result.error }
  }
  if (!result.cert) {
    return { ok: false, error: "no peer certificate returned" }
  }
  return {
    ok: true,
    daysUntilExpiry: result.cert.daysUntilExpiry,
    validTo: result.cert.validTo,
  }
}
