/**
 * Activity-log data layer, backed by the `activity_logs` SQLite table.
 *
 * Every write goes through `recordActivity()`, which mirrors the entry to the
 * structured application logger and swallows all errors — logging must never
 * break a request.
 */

import { randomBytes } from "node:crypto"
import { getDatabase } from "@/lib/database"
import { logger, redact, type LogLevel } from "@/lib/logger"

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const
export const LOG_CATEGORIES = [
  "monitor",
  "incident",
  "notification",
  "auth",
  "api",
  "comment",
  "system",
] as const
export const LOG_ACTOR_TYPES = ["user", "system", "api_key", "agent", "anonymous"] as const

export type LogCategory = (typeof LOG_CATEGORIES)[number]
export type LogActorType = (typeof LOG_ACTOR_TYPES)[number]

const DEFAULT_LEVEL: LogLevel = "info"
const DEFAULT_CATEGORY: LogCategory = "system"
const DEFAULT_ACTOR_TYPE: LogActorType = "system"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export interface ActivityLogRow {
  id: string
  workspace_id: string | null
  actor_id: string | null
  actor_type: string
  actor_label: string | null
  level: string
  event: string
  category: string
  target_type: string | null
  target_id: string | null
  message: string
  metadata: string | null
  request_id: string | null
  ip_hash: string | null
  duration_ms: number | null
  created_at: string
}

export interface ActivityLogInput {
  workspaceId?: string | null
  actorId?: string | null
  actorType?: string
  actorLabel?: string | null
  level?: LogLevel
  event: string
  category?: string
  targetType?: string | null
  targetId?: string | null
  message: string
  metadata?: Record<string, unknown> | null
  requestId?: string | null
  ipHash?: string | null
  durationMs?: number | null
}

export interface ActivityLogQuery {
  workspaceId: string
  level?: string
  category?: string
  event?: string
  actorId?: string
  targetType?: string
  targetId?: string
  search?: string
  since?: string
  until?: string
  limit?: number
  offset?: number
}

export interface ActivityLogPage {
  logs: ActivityLogRow[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface ActivityLogFacet {
  value: string
  count: number
}

export interface ActivityLogFacets {
  categories: ActivityLogFacet[]
  events: ActivityLogFacet[]
  levels: ActivityLogFacet[]
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function newLogId(): string {
  try {
    return "log_" + randomBytes(6).toString("hex")
  } catch {
    let hex = ""
    while (hex.length < 12) hex += Math.floor(Math.random() * 16).toString(16)
    return "log_" + hex.slice(0, 12)
  }
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value !== "string") return fallback
  const v = value.trim().toLowerCase()
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

function nullableText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return fallback
}

function nullableInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.trunc(value)
}

function clampLimit(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : DEFAULT_LIMIT
  if (n < 1) return 1
  if (n > MAX_LIMIT) return MAX_LIMIT
  return n
}

function clampOffset(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0
  return n < 0 ? 0 : n
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => "\\" + m)
}

function serializeMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (metadata === null || metadata === undefined) return null
  try {
    const safe = redact(metadata)
    const json = JSON.stringify(safe)
    return typeof json === "string" ? json : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* writes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Persist one activity-log row and mirror it to the application logger.
 * Never throws; returns the generated id (even if the DB write failed).
 */
export function recordActivity(input: ActivityLogInput): string {
  const id = newLogId()

  let level: LogLevel = DEFAULT_LEVEL
  let event = "unknown"
  let message = ""

  try {
    const safeInput = (input || {}) as ActivityLogInput

    level = oneOf<LogLevel>(safeInput.level, LOG_LEVELS, DEFAULT_LEVEL)
    const category = oneOf<LogCategory>(safeInput.category, LOG_CATEGORIES, DEFAULT_CATEGORY)
    const actorType = oneOf<LogActorType>(safeInput.actorType, LOG_ACTOR_TYPES, DEFAULT_ACTOR_TYPE)

    event = text(safeInput.event, "unknown")
    message = text(safeInput.message, event)

    const workspaceId = nullableText(safeInput.workspaceId)
    const actorId = nullableText(safeInput.actorId)
    const actorLabel = nullableText(safeInput.actorLabel)
    const targetType = nullableText(safeInput.targetType)
    const targetId = nullableText(safeInput.targetId)
    const requestId = nullableText(safeInput.requestId)
    const ipHash = nullableText(safeInput.ipHash)
    const durationMs = nullableInt(safeInput.durationMs)
    const metadata = serializeMetadata(safeInput.metadata)

    try {
      const db = getDatabase()
      db.prepare(
        `INSERT INTO activity_logs (
           id, workspace_id, actor_id, actor_type, actor_label, level, event, category,
           target_type, target_id, message, metadata, request_id, ip_hash, duration_ms
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        workspaceId,
        actorId,
        actorType,
        actorLabel,
        level,
        event,
        category,
        targetType,
        targetId,
        message,
        metadata,
        requestId,
        ipHash,
        durationMs
      )
    } catch (err) {
      try {
        logger.error("activity_log.persist_failed", { logId: id, event, error: err })
      } catch {
        /* ignore */
      }
    }

    // Mirror to the structured logger at the same level.
    try {
      logger[level](message, {
        logId: id,
        event,
        category,
        actorType,
        ...(workspaceId ? { workspaceId } : {}),
        ...(actorId ? { actorId } : {}),
        ...(targetType ? { targetType } : {}),
        ...(targetId ? { targetId } : {}),
        ...(requestId ? { requestId } : {}),
        ...(durationMs !== null ? { durationMs } : {}),
        ...(safeInput.metadata ? { metadata: safeInput.metadata } : {}),
      })
    } catch {
      /* ignore */
    }
  } catch {
    /* logging must never break a request */
  }

  return id
}

/* ------------------------------------------------------------------ */
/* reads                                                               */
/* ------------------------------------------------------------------ */

function buildFilters(q: ActivityLogQuery): { where: string; params: unknown[] } {
  const clauses: string[] = ["workspace_id = ?"]
  const params: unknown[] = [text(q.workspaceId)]

  const level = nullableText(q.level)
  if (level && (LOG_LEVELS as readonly string[]).includes(level.toLowerCase())) {
    clauses.push("level = ?")
    params.push(level.toLowerCase())
  }

  const category = nullableText(q.category)
  if (category && (LOG_CATEGORIES as readonly string[]).includes(category.toLowerCase())) {
    clauses.push("category = ?")
    params.push(category.toLowerCase())
  }

  const event = nullableText(q.event)
  if (event) {
    clauses.push("event = ?")
    params.push(event)
  }

  const actorId = nullableText(q.actorId)
  if (actorId) {
    clauses.push("actor_id = ?")
    params.push(actorId)
  }

  const targetType = nullableText(q.targetType)
  if (targetType) {
    clauses.push("target_type = ?")
    params.push(targetType)
  }

  const targetId = nullableText(q.targetId)
  if (targetId) {
    clauses.push("target_id = ?")
    params.push(targetId)
  }

  const since = nullableText(q.since)
  if (since) {
    clauses.push("created_at >= ?")
    params.push(since)
  }

  const until = nullableText(q.until)
  if (until) {
    clauses.push("created_at <= ?")
    params.push(until)
  }

  const search = nullableText(q.search)
  if (search) {
    const like = "%" + escapeLike(search) + "%"
    clauses.push("(message LIKE ? ESCAPE '\\' OR event LIKE ? ESCAPE '\\')")
    params.push(like, like)
  }

  return { where: clauses.join(" AND "), params }
}

/** Paginated, filtered activity log for one workspace. Parameterized SQL only. */
export function queryActivityLogs(q: ActivityLogQuery): ActivityLogPage {
  const limit = clampLimit(q?.limit)
  const offset = clampOffset(q?.offset)

  const empty: ActivityLogPage = { logs: [], total: 0, limit, offset, hasMore: false }

  try {
    const workspaceId = nullableText(q?.workspaceId)
    if (!workspaceId) return empty

    const { where, params } = buildFilters({ ...q, workspaceId })
    const db = getDatabase()

    const totalRow = db
      .prepare(`SELECT COUNT(*) AS c FROM activity_logs WHERE ${where}`)
      .get(...params) as { c: number } | undefined
    const total = totalRow ? Number(totalRow.c) || 0 : 0

    const logs = db
      .prepare(
        `SELECT id, workspace_id, actor_id, actor_type, actor_label, level, event, category,
                target_type, target_id, message, metadata, request_id, ip_hash, duration_ms, created_at
           FROM activity_logs
          WHERE ${where}
          ORDER BY created_at DESC, id DESC
          LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as ActivityLogRow[]

    return {
      logs,
      total,
      limit,
      offset,
      hasMore: offset + logs.length < total,
    }
  } catch (err) {
    try {
      logger.error("activity_log.query_failed", { error: err })
    } catch {
      /* ignore */
    }
    return empty
  }
}

/** Fetch a single activity-log row scoped to a workspace. */
export function getActivityLog(workspaceId: string, id: string): ActivityLogRow | null {
  try {
    const ws = nullableText(workspaceId)
    const logId = nullableText(id)
    if (!ws || !logId) return null

    const db = getDatabase()
    const row = db
      .prepare(
        `SELECT id, workspace_id, actor_id, actor_type, actor_label, level, event, category,
                target_type, target_id, message, metadata, request_id, ip_hash, duration_ms, created_at
           FROM activity_logs
          WHERE workspace_id = ? AND id = ?`
      )
      .get(ws, logId) as ActivityLogRow | undefined

    return row ?? null
  } catch (err) {
    try {
      logger.error("activity_log.get_failed", { error: err })
    } catch {
      /* ignore */
    }
    return null
  }
}

/** Distinct categories / events / levels with counts, for filter UIs. */
export function activityLogFacets(workspaceId: string): ActivityLogFacets {
  const empty: ActivityLogFacets = { categories: [], events: [], levels: [] }

  try {
    const ws = nullableText(workspaceId)
    if (!ws) return empty

    const db = getDatabase()
    const facet = (column: "category" | "event" | "level", limit: number): ActivityLogFacet[] => {
      const rows = db
        .prepare(
          `SELECT ${column} AS value, COUNT(*) AS count
             FROM activity_logs
            WHERE workspace_id = ? AND ${column} IS NOT NULL AND ${column} <> ''
            GROUP BY ${column}
            ORDER BY count DESC, value ASC
            LIMIT ?`
        )
        .all(ws, limit) as { value: string; count: number }[]
      return rows.map((r) => ({ value: String(r.value), count: Number(r.count) || 0 }))
    }

    return {
      categories: facet("category", 50),
      events: facet("event", 200),
      levels: facet("level", 10),
    }
  } catch (err) {
    try {
      logger.error("activity_log.facets_failed", { error: err })
    } catch {
      /* ignore */
    }
    return empty
  }
}

/** Delete rows older than `olderThanDays`; returns the number of rows deleted. */
export function pruneActivityLogs(olderThanDays: number): number {
  try {
    const days =
      typeof olderThanDays === "number" && Number.isFinite(olderThanDays)
        ? Math.max(0, Math.trunc(olderThanDays))
        : 0
    if (days <= 0) return 0

    const db = getDatabase()
    const info = db
      .prepare(`DELETE FROM activity_logs WHERE created_at < datetime('now', ?)`)
      .run(`-${days} days`)

    return Number(info.changes) || 0
  } catch (err) {
    try {
      logger.error("activity_log.prune_failed", { error: err })
    } catch {
      /* ignore */
    }
    return 0
  }
}
