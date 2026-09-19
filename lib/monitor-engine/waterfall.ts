// Waterfall runners that isolate which layer of a monitor check failed.
//
// The runner walks DNS -> TCP -> TLS -> HTTP -> assertions in strict order.
// The moment a layer fails we stop, tag the failure with the layer name, and
// return partial timings so the UI can show exactly where things broke.

import { performance } from "node:perf_hooks"
import {
  dnsResolve,
  tcpConnect,
  tlsHandshake,
  httpGet,
} from "./probes"

// --------------------------------------------------------------------
// Types
// --------------------------------------------------------------------

export type Layer =
  | "dns"
  | "tcp"
  | "tls"
  | "http"
  | "body"
  | "dependency"
  | "runtime"

export interface LayerResult {
  ok: boolean
  ms?: number
  detail?: string
}

export interface WaterfallResult {
  ok: boolean
  layerFailed?: Layer
  layers: Record<Layer, LayerResult>
  totalMs: number
}

export interface Assertion {
  kind: "status_code" | "body" | "response_ms" | "header"
  op: "eq" | "ne" | "lt" | "gt" | "contains"
  value: string
}

export interface HttpWaterfallOpts {
  method?: string
  assertions?: Assertion[]
  timeoutMs?: number
}

// --------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------

function emptyLayers(): Record<Layer, LayerResult> {
  return {
    dns: { ok: false },
    tcp: { ok: false },
    tls: { ok: false },
    http: { ok: false },
    body: { ok: false },
    dependency: { ok: false },
    runtime: { ok: false },
  }
}

function parseTarget(
  url: string,
): { host: string; port: number; isHttps: boolean } | null {
  try {
    const u = new URL(url)
    const isHttps = u.protocol === "https:"
    const host = u.hostname
    if (!host) return null
    const port = u.port ? Number(u.port) : isHttps ? 443 : 80
    if (!Number.isFinite(port) || port <= 0) return null
    return { host, port, isHttps }
  } catch {
    return null
  }
}

function evaluateAssertion(
  a: Assertion,
  ctx: {
    status?: number
    body?: string
    headers?: Record<string, string>
    responseMs: number
  },
): { ok: boolean; detail: string } {
  const { kind, op, value } = a
  const describe = (subject: string, actual: string | number | undefined) =>
    `${subject} ${op} "${value}" (actual: ${actual ?? "n/a"})`

  if (kind === "status_code") {
    const actual = ctx.status ?? 0
    const target = Number(value)
    let ok = false
    switch (op) {
      case "eq":
        ok = actual === target
        break
      case "ne":
        ok = actual !== target
        break
      case "lt":
        ok = actual < target
        break
      case "gt":
        ok = actual > target
        break
      case "contains":
        ok = String(actual).includes(value)
        break
    }
    return { ok, detail: describe("status_code", actual) }
  }

  if (kind === "response_ms") {
    const actual = ctx.responseMs
    const target = Number(value)
    let ok = false
    switch (op) {
      case "eq":
        ok = actual === target
        break
      case "ne":
        ok = actual !== target
        break
      case "lt":
        ok = actual < target
        break
      case "gt":
        ok = actual > target
        break
      case "contains":
        ok = String(actual).includes(value)
        break
    }
    return { ok, detail: describe("response_ms", actual) }
  }

  if (kind === "body") {
    const actual = ctx.body ?? ""
    let ok = false
    switch (op) {
      case "eq":
        ok = actual === value
        break
      case "ne":
        ok = actual !== value
        break
      case "contains":
        ok = actual.includes(value)
        break
      case "lt":
        ok = actual.length < Number(value)
        break
      case "gt":
        ok = actual.length > Number(value)
        break
    }
    return {
      ok,
      detail: `body ${op} "${value}" (len ${actual.length})`,
    }
  }

  if (kind === "header") {
    // value can be either "Header-Name" or "Header-Name:expected".
    const [rawName, ...rest] = value.split(":")
    const name = (rawName || "").trim().toLowerCase()
    const expected = rest.join(":").trim()
    const actual = ctx.headers?.[name]
    let ok = false
    switch (op) {
      case "eq":
        ok = actual === expected
        break
      case "ne":
        ok = actual !== expected
        break
      case "contains":
        ok = (actual ?? "").includes(expected)
        break
      case "lt":
        ok = Number(actual) < Number(expected)
        break
      case "gt":
        ok = Number(actual) > Number(expected)
        break
    }
    return { ok, detail: describe(`header[${name}]`, actual) }
  }

  return { ok: false, detail: `unknown assertion kind: ${kind as string}` }
}

// --------------------------------------------------------------------
// Runners
// --------------------------------------------------------------------

export async function runHttpWaterfall(
  url: string,
  opts: HttpWaterfallOpts = {},
): Promise<WaterfallResult> {
  const t0 = performance.now()
  const layers = emptyLayers()
  const method = (opts.method || "GET").toUpperCase()
  const timeoutMs = opts.timeoutMs ?? 10000
  const assertions = opts.assertions ?? []

  const parsed = parseTarget(url)
  if (!parsed) {
    layers.runtime = { ok: false, detail: `invalid url: ${url}` }
    return {
      ok: false,
      layerFailed: "runtime",
      layers,
      totalMs: Math.round(performance.now() - t0),
    }
  }
  const { host, port, isHttps } = parsed

  // DNS
  const dns = await dnsResolve(host)
  layers.dns = {
    ok: dns.ok,
    ms: dns.ms,
    detail: dns.ok
      ? `resolved ${dns.addresses?.length ?? 0} address(es)`
      : dns.error,
  }
  if (!dns.ok) {
    return {
      ok: false,
      layerFailed: "dns",
      layers,
      totalMs: Math.round(performance.now() - t0),
    }
  }

  // TCP
  const tcp = await tcpConnect(host, port, Math.min(timeoutMs, 5000))
  layers.tcp = {
    ok: tcp.ok,
    ms: tcp.ms,
    detail: tcp.ok ? `connected to ${host}:${port}` : tcp.error,
  }
  if (!tcp.ok) {
    return {
      ok: false,
      layerFailed: "tcp",
      layers,
      totalMs: Math.round(performance.now() - t0),
    }
  }

  // TLS (only when https)
  if (isHttps) {
    const tlsRes = await tlsHandshake(host, port, Math.min(timeoutMs, 5000))
    layers.tls = {
      ok: tlsRes.ok,
      ms: tlsRes.ms,
      detail: tlsRes.ok
        ? tlsRes.cert
          ? `cert valid, ${tlsRes.cert.daysUntilExpiry}d until expiry`
          : "handshake ok"
        : tlsRes.error,
    }
    if (!tlsRes.ok) {
      return {
        ok: false,
        layerFailed: "tls",
        layers,
        totalMs: Math.round(performance.now() - t0),
      }
    }
  } else {
    layers.tls = { ok: true, ms: 0, detail: "skipped (http)" }
  }

  // HTTP
  const http = await httpGet(url, method, timeoutMs)
  layers.http = {
    ok: http.ok,
    ms: http.ms,
    detail: http.ok
      ? `HTTP ${http.status}`
      : http.error ?? `HTTP ${http.status ?? "?"}`,
  }
  if (!http.ok && http.error) {
    // No status at all -> hard HTTP failure
    return {
      ok: false,
      layerFailed: "http",
      layers,
      totalMs: Math.round(performance.now() - t0),
    }
  }

  // Assertions (body/status/response_ms/header)
  if (assertions.length > 0) {
    const ctx = {
      status: http.status,
      body: http.body,
      headers: http.headers,
      responseMs: http.ms,
    }
    const details: string[] = []
    let ok = true
    let firstBadLayer: Layer | undefined
    for (const a of assertions) {
      const r = evaluateAssertion(a, ctx)
      details.push(`${r.ok ? "PASS" : "FAIL"} ${r.detail}`)
      if (!r.ok && ok) {
        ok = false
        firstBadLayer = a.kind === "status_code" ? "http" : "body"
      }
    }
    if (!ok) {
      layers.body = { ok: false, detail: details.join("; ") }
      if (firstBadLayer === "http") {
        layers.http = { ok: false, ms: http.ms, detail: details.join("; ") }
      }
      return {
        ok: false,
        layerFailed: firstBadLayer ?? "body",
        layers,
        totalMs: Math.round(performance.now() - t0),
      }
    }
    layers.body = { ok: true, detail: details.join("; ") }
  } else {
    // If no assertions were provided but the HTTP layer already reported not-ok
    // (e.g. 5xx), surface that as an HTTP failure.
    if (!http.ok) {
      return {
        ok: false,
        layerFailed: "http",
        layers,
        totalMs: Math.round(performance.now() - t0),
      }
    }
    layers.body = { ok: true, detail: "no assertions" }
  }

  layers.dependency = { ok: true, detail: "n/a" }
  layers.runtime = { ok: true, detail: "n/a" }

  return {
    ok: true,
    layers,
    totalMs: Math.round(performance.now() - t0),
  }
}

export async function runTcpWaterfall(
  host: string,
  port: number,
): Promise<WaterfallResult> {
  const t0 = performance.now()
  const layers = emptyLayers()

  const dns = await dnsResolve(host)
  layers.dns = {
    ok: dns.ok,
    ms: dns.ms,
    detail: dns.ok
      ? `resolved ${dns.addresses?.length ?? 0} address(es)`
      : dns.error,
  }
  if (!dns.ok) {
    return {
      ok: false,
      layerFailed: "dns",
      layers,
      totalMs: Math.round(performance.now() - t0),
    }
  }

  const tcp = await tcpConnect(host, port)
  layers.tcp = {
    ok: tcp.ok,
    ms: tcp.ms,
    detail: tcp.ok ? `connected to ${host}:${port}` : tcp.error,
  }
  if (!tcp.ok) {
    return {
      ok: false,
      layerFailed: "tcp",
      layers,
      totalMs: Math.round(performance.now() - t0),
    }
  }

  // Non-applicable layers stay as ok=true placeholders so downstream code
  // doesn't confuse them with real failures.
  layers.tls = { ok: true, detail: "skipped (tcp monitor)" }
  layers.http = { ok: true, detail: "skipped (tcp monitor)" }
  layers.body = { ok: true, detail: "skipped (tcp monitor)" }
  layers.dependency = { ok: true, detail: "n/a" }
  layers.runtime = { ok: true, detail: "n/a" }

  return { ok: true, layers, totalMs: Math.round(performance.now() - t0) }
}

const SSL_EXPIRY_WARN_DAYS = 14

export async function runSslWaterfall(host: string): Promise<WaterfallResult> {
  const t0 = performance.now()
  const layers = emptyLayers()
  const port = 443

  const dns = await dnsResolve(host)
  layers.dns = {
    ok: dns.ok,
    ms: dns.ms,
    detail: dns.ok
      ? `resolved ${dns.addresses?.length ?? 0} address(es)`
      : dns.error,
  }
  if (!dns.ok) {
    return {
      ok: false,
      layerFailed: "dns",
      layers,
      totalMs: Math.round(performance.now() - t0),
    }
  }

  const tcp = await tcpConnect(host, port)
  layers.tcp = {
    ok: tcp.ok,
    ms: tcp.ms,
    detail: tcp.ok ? `connected to ${host}:${port}` : tcp.error,
  }
  if (!tcp.ok) {
    return {
      ok: false,
      layerFailed: "tcp",
      layers,
      totalMs: Math.round(performance.now() - t0),
    }
  }

  const tlsRes = await tlsHandshake(host, port)
  if (!tlsRes.ok) {
    layers.tls = { ok: false, ms: tlsRes.ms, detail: tlsRes.error }
    return {
      ok: false,
      layerFailed: "tls",
      layers,
      totalMs: Math.round(performance.now() - t0),
    }
  }

  if (!tlsRes.cert) {
    layers.tls = {
      ok: false,
      ms: tlsRes.ms,
      detail: "no peer certificate returned",
    }
    return {
      ok: false,
      layerFailed: "tls",
      layers,
      totalMs: Math.round(performance.now() - t0),
    }
  }

  const expiring = tlsRes.cert.daysUntilExpiry <= SSL_EXPIRY_WARN_DAYS
  layers.tls = {
    ok: !expiring,
    ms: tlsRes.ms,
    detail: expiring
      ? `cert expires in ${tlsRes.cert.daysUntilExpiry}d (<= ${SSL_EXPIRY_WARN_DAYS}d)`
      : `cert valid, ${tlsRes.cert.daysUntilExpiry}d until expiry`,
  }
  if (expiring) {
    return {
      ok: false,
      layerFailed: "tls",
      layers,
      totalMs: Math.round(performance.now() - t0),
    }
  }

  layers.http = { ok: true, detail: "skipped (ssl monitor)" }
  layers.body = { ok: true, detail: "skipped (ssl monitor)" }
  layers.dependency = { ok: true, detail: "n/a" }
  layers.runtime = { ok: true, detail: "n/a" }

  return { ok: true, layers, totalMs: Math.round(performance.now() - t0) }
}
