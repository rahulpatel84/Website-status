import { NextResponse } from "next/server"
import { z } from "zod"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import {
  queryLogs,
  type LogEvent,
  type LogLevel,
  type LogQuery,
  type LogSource,
} from "@/lib/logs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const LEVEL_VALUES = ["debug", "info", "warn", "error"] as const satisfies readonly LogLevel[]
const SOURCE_VALUES = [
  "monitor",
  "incident",
  "notification",
  "api",
  "auth",
  "system",
  "public",
] as const satisfies readonly LogSource[]

/** Hard cap on exported rows. */
const MAX_ROWS = 5000
/** Rows pulled from the store per stream chunk (== lib/logs MAX_LOG_LIMIT). */
const PAGE_SIZE = 500

const isoDateString = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "must be an ISO-8601 date/time string (e.g. 2026-09-05T00:00:00.000Z)",
  })
  .transform((v) => new Date(v).toISOString())

const querySchema = z.object({
  levels: z.array(z.enum(LEVEL_VALUES)).max(LEVEL_VALUES.length).optional(),
  sources: z.array(z.enum(SOURCE_VALUES)).max(SOURCE_VALUES.length).optional(),
  event: z.string().trim().min(1).max(200).optional(),
  search: z.string().trim().min(1).max(500).optional(),
  targetType: z.string().trim().min(1).max(100).optional(),
  targetId: z.string().trim().min(1).max(200).optional(),
  since: isoDateString.optional(),
  until: isoDateString.optional(),
  limit: z.coerce
    .number({ invalid_type_error: "must be a number" })
    .int("must be an integer")
    .min(1, "must be >= 1")
    .max(MAX_ROWS, `must be <= ${MAX_ROWS}`)
    .default(MAX_ROWS),
  offset: z.coerce
    .number({ invalid_type_error: "must be a number" })
    .int("must be an integer")
    .min(0, "must be >= 0")
    .default(0),
})

type ParsedQuery = z.infer<typeof querySchema>

function paramName(path: (string | number)[]): string {
  const key = String(path[0] ?? "query")
  if (key === "levels") return "level"
  if (key === "sources") return "source"
  if (key === "search") return "q"
  return key
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${paramName(issue.path)}: ${issue.message}`)
}

/** Reads a repeatable param that also accepts comma-separated values. */
function readList(params: URLSearchParams, key: string): string[] | undefined {
  const raw = params.getAll(key)
  if (raw.length === 0) return undefined
  const values = raw
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
  return values.length > 0 ? values : undefined
}

function readScalar(params: URLSearchParams, key: string): string | undefined {
  const raw = params.get(key)
  if (raw === null) return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function rawQueryInput(params: URLSearchParams): Record<string, unknown> {
  const input: Record<string, unknown> = {}
  const levels = readList(params, "level")
  if (levels) input.levels = levels
  const sources = readList(params, "source")
  if (sources) input.sources = sources
  const event = readScalar(params, "event")
  if (event) input.event = event
  const search = readScalar(params, "q")
  if (search) input.search = search
  const targetType = readScalar(params, "targetType")
  if (targetType) input.targetType = targetType
  const targetId = readScalar(params, "targetId")
  if (targetId) input.targetId = targetId
  const since = readScalar(params, "since")
  if (since) input.since = since
  const until = readScalar(params, "until")
  if (until) input.until = until
  const limit = readScalar(params, "limit")
  if (limit) input.limit = limit
  const offset = readScalar(params, "offset")
  if (offset) input.offset = offset
  return input
}

/** Filters only — limit/offset are managed by the streaming pager below. */
function baseQuery(parsed: ParsedQuery, workspaceId: string): LogQuery {
  return {
    workspaceId,
    levels: parsed.levels,
    sources: parsed.sources,
    event: parsed.event,
    search: parsed.search,
    targetType: parsed.targetType,
    targetId: parsed.targetId,
    since: parsed.since,
    until: parsed.until,
  }
}

const CSV_COLUMNS = [
  "id",
  "created_at",
  "level",
  "source",
  "event",
  "message",
  "actor_id",
  "actor_label",
  "target_type",
  "target_id",
  "duration_ms",
  "request_id",
  "ip_hash",
  "workspace_id",
  "metadata",
] as const

/**
 * RFC 4180 field encoding: wrap in double quotes when the value contains a
 * quote, comma, CR/LF or edge whitespace, and double up any embedded quotes.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = typeof value === "string" ? value : String(value)
  if (str === "") return ""
  if (/["\r\n,]/.test(str) || str !== str.trim()) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function csvRow(values: readonly unknown[]): string {
  return values.map(csvEscape).join(",") + "\r\n"
}

function serializeMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return ""
  try {
    return JSON.stringify(metadata)
  } catch {
    return ""
  }
}

function logToCsvRow(row: LogEvent): string {
  return csvRow([
    row.id,
    row.created_at,
    row.level,
    row.source,
    row.event,
    row.message,
    row.actor_id,
    row.actor_label,
    row.target_type,
    row.target_id,
    row.duration_ms,
    row.request_id,
    row.ip_hash,
    row.workspace_id,
    serializeMetadata(row.metadata),
  ])
}

export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)

  const params = new URL(request.url).searchParams
  const parsed = querySchema.safeParse(rawQueryInput(params))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: formatIssues(parsed.error) },
      { status: 400 },
    )
  }

  if (parsed.data.since && parsed.data.until && parsed.data.since > parsed.data.until) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: ["since: must be before until"] },
      { status: 400 },
    )
  }

  const filters = baseQuery(parsed.data, ws.id)
  const maxRows = Math.min(parsed.data.limit, MAX_ROWS)

  // Probe once so a broken store surfaces as JSON 500 rather than mid-stream.
  try {
    queryLogs({ ...filters, limit: 1, offset: parsed.data.offset })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to query logs"
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const encoder = new TextEncoder()
  let offset = parsed.data.offset
  let emitted = 0
  let headerSent = false

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!headerSent) {
        headerSent = true
        controller.enqueue(encoder.encode(csvRow(CSV_COLUMNS)))
        return
      }

      if (emitted >= maxRows) {
        controller.close()
        return
      }

      const take = Math.min(PAGE_SIZE, maxRows - emitted)
      let rows: LogEvent[]
      try {
        rows = queryLogs({ ...filters, limit: take, offset }).rows
      } catch {
        controller.close()
        return
      }

      if (rows.length === 0) {
        controller.close()
        return
      }

      let chunk = ""
      for (const row of rows) chunk += logToCsvRow(row)
      controller.enqueue(encoder.encode(chunk))

      emitted += rows.length
      offset += rows.length
      if (rows.length < take) controller.close()
    },
  })

  const filename = `logs-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
