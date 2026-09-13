// @statuswatch/agent — install-in-project uptime SDK with layer isolation.
// Zero non-Node dependencies. Works with plain Node >= 18.

import { performance } from "node:perf_hooks"
import * as dns from "node:dns/promises"
import * as net from "node:net"
import * as tls from "node:tls"
import { URL } from "node:url"
import * as https from "node:https"
import * as http from "node:http"

export type Layer =
  | "dns"
  | "tcp"
  | "tls"
  | "http_head"
  | "body_assertion"
  | "dependency"
  | "runtime"

export interface DiagLayer {
  ok: boolean
  ms?: number
  detail?: string
}

export interface DiagReport {
  ok: boolean
  layerFailed?: Layer
  layers: Partial<Record<Layer, DiagLayer>>
  runtime: {
    eventLoopLagMs: number
    memoryMB: number
    uptimeS: number
  }
}

export interface InitOptions {
  project: string
  token: string
  endpoint?: string
  dependencies?: Record<string, () => Promise<unknown>>
}

export interface StatuswatchInstance {
  diagnose(): Promise<DiagReport>
  expressHealth(): (req: any, res: any) => Promise<void>
  ingest(kind: string, payload: Record<string, unknown>): Promise<void>
}

export interface Job {
  start(): Promise<void>
  complete(): Promise<void>
  fail(err?: unknown): Promise<void>
  run<T>(fn: () => Promise<T>): Promise<T>
}

export class Statuswatch {
  private static current: InitOptions | null = null

  static init(opts: InitOptions): StatuswatchInstance {
    Statuswatch.current = {
      endpoint: "https://api.statuswatch.io",
      ...opts,
    }
    return {
      diagnose: () => diagnose(opts.dependencies ?? {}),
      expressHealth: () => async (_req: any, res: any) => {
        const report = await diagnose(opts.dependencies ?? {})
        res.status(report.ok ? 200 : 503).json(report)
      },
      ingest: (kind, payload) => ingest(kind, payload),
    }
  }

  static job(name: string): Job {
    const j: Job = {
      async start() {
        await ingest("job.start", { name })
      },
      async complete() {
        await ingest("job.complete", { name })
      },
      async fail(err?: unknown) {
        await ingest("job.fail", {
          name,
          error: err instanceof Error ? err.message : String(err ?? "unknown"),
        })
      },
      async run<T>(fn: () => Promise<T>): Promise<T> {
        await j.start()
        try {
          const result = await fn()
          await j.complete()
          return result
        } catch (e) {
          await j.fail(e)
          throw e
        }
      },
    }
    return j
  }

  static heartbeat(monitorId: string): Promise<void> {
    if (!Statuswatch.current) return Promise.resolve()
    const url = `${Statuswatch.current.endpoint}/api/heartbeat/${monitorId}`
    return httpPost(url, "").catch(() => {})
  }
}

async function ingest(kind: string, payload: Record<string, unknown>): Promise<void> {
  if (!Statuswatch["current"]) return
  const { endpoint, token, project } = Statuswatch["current"] as InitOptions
  const url = `${endpoint}/ingest`
  await httpPost(url, JSON.stringify({ project, kind, payload }), {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }).catch(() => {})
}

async function diagnose(
  dependencies: Record<string, () => Promise<unknown>>,
): Promise<DiagReport> {
  const layers: Partial<Record<Layer, DiagLayer>> = {}
  let failedLayer: Layer | undefined
  let ok = true

  // 1) runtime — event loop lag + memory
  const lag = await measureEventLoopLag()
  const mem = process.memoryUsage()
  const runtime = {
    eventLoopLagMs: Math.round(lag),
    memoryMB: Math.round(mem.heapUsed / 1024 / 1024),
    uptimeS: Math.round(process.uptime()),
  }
  layers.runtime = { ok: lag < 500, ms: Math.round(lag), detail: `lag ${Math.round(lag)}ms` }
  if (!layers.runtime.ok) {
    ok = false
    failedLayer = "runtime"
  }

  // 2) dependencies
  for (const [name, probe] of Object.entries(dependencies)) {
    const t0 = performance.now()
    try {
      await probe()
      const ms = Math.round(performance.now() - t0)
      layers.dependency ??= { ok: true, ms, detail: `${name} ok in ${ms}ms` }
    } catch (e: any) {
      const ms = Math.round(performance.now() - t0)
      layers.dependency = { ok: false, ms, detail: `${name}: ${e?.message || "failed"}` }
      if (ok) {
        ok = false
        failedLayer = "dependency"
      }
    }
  }

  return { ok, layerFailed: failedLayer, layers, runtime }
}

function measureEventLoopLag(): Promise<number> {
  return new Promise((resolve) => {
    const start = performance.now()
    setImmediate(() => resolve(performance.now() - start))
  })
}

// Layer-specific probes (usable by consumers if they want)

export async function dnsResolve(host: string): Promise<DiagLayer> {
  const t0 = performance.now()
  try {
    const addrs = await dns.resolve4(host)
    return { ok: true, ms: Math.round(performance.now() - t0), detail: addrs.join(",") }
  } catch (e: any) {
    return { ok: false, ms: Math.round(performance.now() - t0), detail: e.message }
  }
}

export function tcpConnect(host: string, port: number, timeout = 5000): Promise<DiagLayer> {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const sock = net.connect(port, host)
    const done = (result: DiagLayer) => {
      try {
        sock.destroy()
      } catch {}
      resolve(result)
    }
    sock.setTimeout(timeout)
    sock.on("connect", () =>
      done({ ok: true, ms: Math.round(performance.now() - t0), detail: "connected" }),
    )
    sock.on("timeout", () =>
      done({ ok: false, ms: Math.round(performance.now() - t0), detail: "timeout" }),
    )
    sock.on("error", (e) =>
      done({ ok: false, ms: Math.round(performance.now() - t0), detail: e.message }),
    )
  })
}

export function tlsHandshake(host: string, port = 443, timeout = 5000): Promise<DiagLayer> {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const sock = tls.connect(
      { host, port, servername: host, rejectUnauthorized: true },
      () => {
        const cert = sock.getPeerCertificate()
        const daysLeft = cert?.valid_to
          ? Math.round((Date.parse(cert.valid_to) - Date.now()) / 86400000)
          : undefined
        sock.end()
        resolve({
          ok: true,
          ms: Math.round(performance.now() - t0),
          detail: daysLeft ? `cert expires in ${daysLeft} days` : "ok",
        })
      },
    )
    sock.setTimeout(timeout)
    sock.on("timeout", () => {
      sock.destroy()
      resolve({ ok: false, ms: Math.round(performance.now() - t0), detail: "timeout" })
    })
    sock.on("error", (e) =>
      resolve({ ok: false, ms: Math.round(performance.now() - t0), detail: e.message }),
    )
  })
}

// -------- Internal HTTP client --------

function httpPost(
  urlStr: string,
  body: string,
  headers: Record<string, string> = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    let u: URL
    try {
      u = new URL(urlStr)
    } catch (e) {
      return reject(e)
    }
    const lib = u.protocol === "https:" ? https : http
    const req = lib.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          ...headers,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.on("data", () => {})
        res.on("end", () => resolve())
      },
    )
    req.on("error", reject)
    req.setTimeout(5000, () => req.destroy(new Error("timeout")))
    req.write(body)
    req.end()
  })
}
