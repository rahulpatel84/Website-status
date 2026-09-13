import { randomUUID } from "node:crypto"

import { getDatabase } from "@/lib/database"

// ============================================================
// Platform-wide event / activity log
//
// Server-side only. Backed by the `event_logs` table created in
// `initializeTables()` (lib/database.ts).
// ============================================================

export type LogLevel = "debug" | "info" | "warn" | "error"

export type LogSource = "monitor" | "incident" | "notification" | "api" | "auth" | "system" | "public"

export const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"] as const

export const LOG_SOURCES: readonly LogSource[] = [
  "monitor",
  "incident",
  "notification",
  "api",
  "auth",
  "system",
  "public",
] as const

/** A log row as it comes back out of the database. */
export interface LogEvent {
  id: string
  workspace_id: string | null
  actor_id: string | null
  actor_label: string | null
  level: LogLevel
  source: LogSource
  event: string
  message: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown> | null
  request_id: string | null
  ip_hash: string | null
  duration_ms: number | null
  created_at: string
}

/** What callers hand to `logEvent()`. */
export interface LogInput {
  workspaceId?: string | null
  actorId?: string | null
  actorLabel?: string | null
  level?: LogLevel
  source: LogSource
  event: string
  message: string
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
  requestId?: string | null
  ipHash?: string | null
  durationMs?: number | null
}

/** Filters accepted by `queryLogs()`. */
export interface LogQuery {
  workspaceId?: string | null
  levels?: LogLevel[]
  sources?: LogSource[]
  event?: string
  search?: string
  targetType?: string
  targetId?: string
  since?: string
  until?: string
  limit?: number
  offset?: number
}

export const DEFAULT_LOG_LIMIT = 50
export const MAX_LOG_LIMIT = 500

type SqlParam = string | number | null

/** Raw shape of an `event_logs` row before `metadata` is parsed. */
interface EventLogRow {
  id: string
  workspace_id: string | null
  actor_id: string | null
  actor_label: string | null
  level: string
  source: string
  event: string
  message: string
  target_type: string | null
  target_id: string | null
  metadata: string | null
  request_id: string | null
  ip_hash: string | null
  duration_ms: number | null
  created_at: string
}

function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && (LOG_LEVELS as readonly string[]).includes(value)
}

function isLogSource(value: unknown): value is LogSource {
  return typeof value === "string" && (LOG_SOURCES as readonly string[]).includes(value)
}

function nullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function nullableInt(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.round(value)
}

function serializeMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (metadata === null || metadata === undefined) return null
  try {
    const json = JSON.stringify(metadata)
    return typeof json === "string" ? json : null
  } catch {
    return null
  }
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (raw === null || raw === undefined || raw === "") return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

function mapRow(row: EventLogRow): LogEvent {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    actor_id: row.actor_id,
    actor_label: row.actor_label,
    level: isLogLevel(row.level) ? row.level : "info",
    source: isLogSource(row.source) ? row.source : "system",
    event: row.event,
    message: row.message,
    target_type: row.target_type,
    target_id: row.target_id,
    metadata: parseMetadata(row.metadata),
    request_id: row.request_id,
    ip_hash: row.ip_hash,
    duration_ms: row.duration_ms === null ? null : Number(row.duration_ms),
    created_at: row.created_at,
  }
}

/** Escape `%` / `_` / `\` so user input can't act as LIKE wildcards. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * Fire-and-forget structured log write.
 *
 * This function NEVER throws — logging must not be able to break the request
 * that produced it. Failures are reported on `console.error` and swallowed.
 */
export function logEvent(input: LogInput): void {
  try {
    if (!input || typeof input !== "object") return

    const source: LogSource = isLogSource(input.source) ? input.source : "system"
    const level: LogLevel = isLogLevel(input.level) ? input.level : "info"
    const event = typeof input.event === "string" ? input.event.trim() : ""
    const message = typeof input.message === "string" ? input.message : ""

    if (event.length === 0) return

    const db = getDatabase()
    db.prepare(
      `INSERT INTO event_logs (
        id, workspace_id, actor_id, actor_label, level, source, event, message,
        target_type, target_id, metadata, request_id, ip_hash, duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `log_${randomUUID()}`,
      nullableText(input.workspaceId),
      nullableText(input.actorId),
      nullableText(input.actorLabel),
      level,
      source,
      event,
      message,
      nullableText(input.targetType),
      nullableText(input.targetId),
      serializeMetadata(input.metadata),
      nullableText(input.requestId),
      nullableText(input.ipHash),
      nullableInt(input.durationMs),
      new Date().toISOString(),
    )
  } catch (error) {
    console.error("[logs] failed to write event log:", error)
  }
}

/**
 * Paginated, filtered log read.
 *
 * `workspaceId`: omit (or pass `undefined`) for "every workspace"; pass `null`
 * to select only platform-level rows that have no workspace attached.
 *
 * All user input is bound as SQL parameters — nothing is interpolated into the
 * statement except `?` placeholder counts we generate ourselves.
 */
export function queryLogs(q: LogQuery): {
  rows: LogEvent[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
} {
  const query: LogQuery = q && typeof q === "object" ? q : ({} as LogQuery)

  const rawLimit = typeof query.limit === "number" && Number.isFinite(query.limit) ? Math.floor(query.limit) : DEFAULT_LOG_LIMIT
  const limit = Math.min(MAX_LOG_LIMIT, Math.max(1, rawLimit))

  const rawOffset = typeof query.offset === "number" && Number.isFinite(query.offset) ? Math.floor(query.offset) : 0
  const offset = Math.max(0, rawOffset)

  const where: string[] = []
  const params: SqlParam[] = []

  if (query.workspaceId === null) {
    where.push("workspace_id IS NULL")
  } else if (typeof query.workspaceId === "string" && query.workspaceId.length > 0) {
    where.push("workspace_id = ?")
    params.push(query.workspaceId)
  }

  const levels = Array.isArray(query.levels) ? query.levels.filter(isLogLevel) : []
  if (levels.length > 0) {
    where.push(`level IN (${levels.map(() => "?").join(", ")})`)
    for (const level of levels) params.push(level)
  }

  const sources = Array.isArray(query.sources) ? query.sources.filter(isLogSource) : []
  if (sources.length > 0) {
    where.push(`source IN (${sources.map(() => "?").join(", ")})`)
    for (const source of sources) params.push(source)
  }

  if (typeof query.event === "string" && query.event.trim().length > 0) {
    where.push("event = ?")
    params.push(query.event.trim())
  }

  if (typeof query.targetType === "string" && query.targetType.trim().length > 0) {
    where.push("target_type = ?")
    params.push(query.targetType.trim())
  }

  if (typeof query.targetId === "string" && query.targetId.trim().length > 0) {
    where.push("target_id = ?")
    params.push(query.targetId.trim())
  }

  if (typeof query.since === "string" && query.since.length > 0) {
    where.push("created_at >= ?")
    params.push(query.since)
  }

  if (typeof query.until === "string" && query.until.length > 0) {
    where.push("created_at <= ?")
    params.push(query.until)
  }

  if (typeof query.search === "string" && query.search.trim().length > 0) {
    const needle = `%${escapeLike(query.search.trim())}%`
    where.push("(message LIKE ? ESCAPE '\\' OR event LIKE ? ESCAPE '\\')")
    params.push(needle, needle)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""

  try {
    const db = getDatabase()

    const countRow = db.prepare(`SELECT COUNT(*) AS total FROM event_logs ${whereSql}`).get(...params) as
      | { total: number }
      | undefined
    const total = countRow ? Number(countRow.total) : 0

    const rows = db
      .prepare(
        `SELECT id, workspace_id, actor_id, actor_label, level, source, event, message,
                target_type, target_id, metadata, request_id, ip_hash, duration_ms, created_at
         FROM event_logs
         ${whereSql}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as EventLogRow[]

    const mapped = rows.map(mapRow)

    return {
      rows: mapped,
      total,
      limit,
      offset,
      hasMore: offset + mapped.length < total,
    }
  } catch (error) {
    console.error("[logs] failed to query event logs:", error)
    return { rows: [], total: 0, limit, offset, hasMore: false }
  }
}

/**
 * Count log rows per level over the last `sinceHours` hours.
 *
 * `workspaceId === null` means "across every workspace" (platform-wide view).
 */
export function logStats(workspaceId: string | null, sinceHours: number): { level: LogLevel; count: number }[] {
  const hours = typeof sinceHours === "number" && Number.isFinite(sinceHours) ? Math.max(0, sinceHours) : 24
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const where: string[] = ["created_at >= ?"]
  const params: SqlParam[] = [since]

  if (typeof workspaceId === "string" && workspaceId.length > 0) {
    where.push("workspace_id = ?")
    params.push(workspaceId)
  }

  try {
    const db = getDatabase()
    const rows = db
      .prepare(
        `SELECT level, COUNT(*) AS count
         FROM event_logs
         WHERE ${where.join(" AND ")}
         GROUP BY level`,
      )
      .all(...params) as { level: string; count: number }[]

    const counts = new Map<LogLevel, number>()
    for (const row of rows) {
      if (isLogLevel(row.level)) counts.set(row.level, Number(row.count))
    }

    return LOG_LEVELS.map((level) => ({ level, count: counts.get(level) ?? 0 }))
  } catch (error) {
    console.error("[logs] failed to compute log stats:", error)
    return LOG_LEVELS.map((level) => ({ level, count: 0 }))
  }
}

/** Delete log rows older than `days` days. Returns the number of rows deleted. */
export function purgeLogsOlderThan(days: number): number {
  if (typeof days !== "number" || !Number.isFinite(days) || days < 0) return 0

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  try {
    const db = getDatabase()
    const info = db.prepare("DELETE FROM event_logs WHERE created_at < ?").run(cutoff)
    return Number(info.changes) || 0
  } catch (error) {
    console.error("[logs] failed to purge event logs:", error)
    return 0
  }
}
