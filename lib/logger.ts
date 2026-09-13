/**
 * Structured application logger.
 *
 * - Level threshold from `process.env.LOG_LEVEL` (default: "debug" in dev, "info" in production).
 * - Production: single-line JSON to stdout/stderr — `{ts, level, msg, ...ctx}`.
 * - Development: readable colourless line — `HH:MM:SS LEVEL msg {ctx}`.
 * - `error`/`warn` go to console.error / console.warn.
 * - Context is auto-redacted via `redact()`; `Error` values become `{name, message, stack}`.
 * - Never throws.
 */

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogContext {
  [k: string]: unknown
}

export interface Logger {
  debug(msg: string, ctx?: LogContext): void
  info(msg: string, ctx?: LogContext): void
  warn(msg: string, ctx?: LogContext): void
  error(msg: string, ctx?: LogContext): void
  child(ctx: LogContext): Logger
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const SENSITIVE_KEY_RE = /pass|secret|token|key|authorization|cookie|apikey/i

const REDACTED = "[redacted]"

/** Deep-clone `value`, replacing values of sensitive-looking keys with "[redacted]". */
export function redact<T>(value: T): T {
  try {
    return redactInternal(value, new WeakMap<object, unknown>(), 0) as T
  } catch {
    return value
  }
}

function redactInternal(value: unknown, seen: WeakMap<object, unknown>, depth: number): unknown {
  if (depth > 12) return "[max-depth]"
  if (value === null || value === undefined) return value

  const t = typeof value
  if (t === "string" || t === "number" || t === "boolean" || t === "bigint") return value
  if (t === "function") return "[function]"
  if (t === "symbol") return String(value as symbol)

  if (value instanceof Date) return new Date(value.getTime())
  if (value instanceof Error) return serializeError(value)

  const obj = value as object
  const cached = seen.get(obj)
  if (cached !== undefined) return cached

  if (Array.isArray(value)) {
    const out: unknown[] = []
    seen.set(obj, out)
    for (const item of value) out.push(redactInternal(item, seen, depth + 1))
    return out
  }

  if (value instanceof Map) {
    const out: Record<string, unknown> = {}
    seen.set(obj, out)
    for (const [k, v] of value.entries()) {
      const key = String(k)
      out[key] = SENSITIVE_KEY_RE.test(key) ? REDACTED : redactInternal(v, seen, depth + 1)
    }
    return out
  }

  if (value instanceof Set) {
    const out: unknown[] = []
    seen.set(obj, out)
    for (const item of value.values()) out.push(redactInternal(item, seen, depth + 1))
    return out
  }

  const out: Record<string, unknown> = {}
  seen.set(obj, out)
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = REDACTED
      continue
    }
    out[key] = redactInternal((value as Record<string, unknown>)[key], seen, depth + 1)
  }
  return out
}

function serializeError(err: Error): { name: string; message: string; stack?: string } {
  return {
    name: err.name,
    message: err.message,
    stack: typeof err.stack === "string" ? err.stack : undefined,
  }
}

function isProduction(): boolean {
  try {
    return process.env.NODE_ENV === "production"
  } catch {
    return false
  }
}

function thresholdLevel(): LogLevel {
  let raw: string | undefined
  try {
    raw = process.env.LOG_LEVEL
  } catch {
    raw = undefined
  }
  const normalized = typeof raw === "string" ? raw.trim().toLowerCase() : ""
  if (normalized === "debug" || normalized === "info" || normalized === "warn" || normalized === "error") {
    return normalized
  }
  return isProduction() ? "info" : "debug"
}

function isEnabled(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[thresholdLevel()]
}

/** "req_" + 12 hex characters. */
export function createRequestId(): string {
  let hex = ""
  try {
    const bytes = new Uint8Array(6)
    const cryptoRef = (globalThis as { crypto?: Crypto }).crypto
    if (cryptoRef && typeof cryptoRef.getRandomValues === "function") {
      cryptoRef.getRandomValues(bytes)
      for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0")
    }
  } catch {
    hex = ""
  }
  while (hex.length < 12) {
    hex += Math.floor(Math.random() * 16).toString(16)
  }
  return "req_" + hex.slice(0, 12)
}

function twoDigits(n: number): string {
  return n < 10 ? "0" + n : String(n)
}

function timeOfDay(d: Date): string {
  return `${twoDigits(d.getHours())}:${twoDigits(d.getMinutes())}:${twoDigits(d.getSeconds())}`
}

function safeStringify(value: unknown): string {
  try {
    const seen = new WeakSet<object>()
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === "bigint") return v.toString()
      if (typeof v === "object" && v !== null) {
        if (seen.has(v as object)) return "[circular]"
        seen.add(v as object)
      }
      return v
    }) ?? "null"
  } catch {
    try {
      return String(value)
    } catch {
      return "[unserializable]"
    }
  }
}

function writeLine(level: LogLevel, line: string): void {
  try {
    if (level === "error") {
      console.error(line)
    } else if (level === "warn") {
      console.warn(line)
    } else {
      console.log(line)
    }
  } catch {
    /* logging must never throw */
  }
}

function emit(level: LogLevel, baseCtx: LogContext, msg: string, ctx?: LogContext): void {
  try {
    if (!isEnabled(level)) return

    const merged: LogContext = { ...baseCtx, ...(ctx || {}) }
    const safeCtx = redact(merged) as LogContext
    const message = typeof msg === "string" ? msg : safeStringify(msg)
    const now = new Date()

    if (isProduction()) {
      writeLine(level, safeStringify({ ts: now.toISOString(), level, msg: message, ...safeCtx }))
      return
    }

    const hasCtx = Object.keys(safeCtx).length > 0
    const suffix = hasCtx ? " " + safeStringify(safeCtx) : ""
    writeLine(level, `${timeOfDay(now)} ${level.toUpperCase()} ${message}${suffix}`)
  } catch {
    /* logging must never throw */
  }
}

function build(baseCtx: LogContext): Logger {
  return {
    debug(msg: string, ctx?: LogContext) {
      emit("debug", baseCtx, msg, ctx)
    },
    info(msg: string, ctx?: LogContext) {
      emit("info", baseCtx, msg, ctx)
    },
    warn(msg: string, ctx?: LogContext) {
      emit("warn", baseCtx, msg, ctx)
    },
    error(msg: string, ctx?: LogContext) {
      emit("error", baseCtx, msg, ctx)
    },
    child(ctx: LogContext): Logger {
      return build({ ...baseCtx, ...(ctx || {}) })
    },
  }
}

/** Create a logger bound to a base context. */
export function createLogger(ctx?: LogContext): Logger {
  return build({ ...(ctx || {}) })
}

/** Default application logger. */
export const logger: Logger = createLogger()
