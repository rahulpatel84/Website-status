import { NextResponse } from "next/server"
import { z } from "zod"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { queryLogs, type LogLevel, type LogQuery, type LogSource } from "@/lib/logs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Literal tuples so zod can build enums; `satisfies` keeps them in lockstep
// with the union types exported by lib/logs.
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

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

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
    .max(MAX_LIMIT, `must be <= ${MAX_LIMIT}`)
    .default(DEFAULT_LIMIT),
  offset: z.coerce
    .number({ invalid_type_error: "must be a number" })
    .int("must be an integer")
    .min(0, "must be >= 0")
    .default(0),
})

type ParsedQuery = z.infer<typeof querySchema>

/** Query-param name for a schema key, so error messages name what the caller sent. */
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

/** Shape raw URLSearchParams into the schema's input shape. */
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

/** Build a workspace-scoped LogQuery. workspaceId is never client-controlled. */
function toLogQuery(parsed: ParsedQuery, workspaceId: string): LogQuery {
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
    limit: parsed.limit,
    offset: parsed.offset,
  }
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

  try {
    const result = queryLogs(toLogQuery(parsed.data, ws.id))
    return NextResponse.json(
      {
        logs: result.rows,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to query logs"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
