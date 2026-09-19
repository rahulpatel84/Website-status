import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import {
  LOG_CATEGORIES,
  LOG_LEVELS,
  activityLogFacets,
  queryActivityLogs,
  recordActivity,
} from "@/lib/activity-log"
import { createRequestId, logger, type LogLevel } from "@/lib/logger"
import { checkRate } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const LEVELS: readonly string[] = LOG_LEVELS
const CATEGORIES: readonly string[] = LOG_CATEGORIES

const EVENT_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/
const MAX_EVENT_LENGTH = 80
const MAX_MESSAGE_LENGTH = 2000
const MAX_METADATA_BYTES = 8 * 1024

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const RATE_MAX = 120
const RATE_WINDOW_MS = 60_000

function isLogLevel(value: string): value is LogLevel {
  return LEVELS.includes(value)
}

interface LogFilters {
  level?: string
  category?: string
  event?: string
  actorId?: string
  targetType?: string
  targetId?: string
  search?: string
  since?: string
  until?: string
}

function trimmedParam(url: URL, key: string): string | undefined {
  const raw = url.searchParams.get(key)
  if (raw === null) return undefined
  const value = raw.trim()
  return value ? value : undefined
}

/** Kept in sync with the identical parser in app/api/logs/export/route.ts so both
 *  endpoints honour the same filters. Next route modules may not export
 *  non-handler values, so this cannot be shared via an import. */
function parseLogFilters(url: URL): LogFilters {
  const level = trimmedParam(url, "level")
  const category = trimmedParam(url, "category")

  return {
    level: level && LEVELS.includes(level) ? level : undefined,
    category: category && CATEGORIES.includes(category) ? category : undefined,
    event: trimmedParam(url, "event"),
    actorId: trimmedParam(url, "actorId"),
    targetType: trimmedParam(url, "targetType"),
    targetId: trimmedParam(url, "targetId"),
    search: trimmedParam(url, "search"),
    since: trimmedParam(url, "since"),
    until: trimmedParam(url, "until"),
  }
}

function parseLimit(url: URL): number {
  const raw = Number(url.searchParams.get("limit"))
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(raw)))
}

function parseOffset(url: URL): number {
  const raw = Number(url.searchParams.get("offset"))
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.floor(raw))
}

export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)

  const requestId = createRequestId()
  const url = new URL(request.url)
  const filters = parseLogFilters(url)
  const limit = parseLimit(url)
  const offset = parseOffset(url)

  const result = queryActivityLogs({
    workspaceId: ws.id,
    ...filters,
    limit,
    offset,
  })
  const facets = activityLogFacets(ws.id)

  logger.info("logs.query", {
    requestId,
    workspaceId: ws.id,
    count: result.logs.length,
    total: result.total,
  })

  return NextResponse.json(
    {
      logs: result.logs,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
      facets,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)

  const requestId = createRequestId()

  if (!checkRate(`logs:${ws.id}`, RATE_MAX, RATE_WINDOW_MS)) {
    logger.warn("logs.ingest.rate_limited", { requestId, workspaceId: ws.id })
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const event = String(body.event ?? "").trim()
  const message = String(body.message ?? "").trim()
  const level = body.level === undefined ? undefined : String(body.level).trim()
  const category = body.category === undefined ? undefined : String(body.category).trim()
  const targetType = body.targetType ? String(body.targetType).trim() : undefined
  const targetId = body.targetId ? String(body.targetId).trim() : undefined

  if (!event) return NextResponse.json({ error: "event is required" }, { status: 400 })
  if (event.length > MAX_EVENT_LENGTH)
    return NextResponse.json(
      { error: `event must be at most ${MAX_EVENT_LENGTH} characters` },
      { status: 400 },
    )
  if (!EVENT_PATTERN.test(event))
    return NextResponse.json({ error: "invalid event" }, { status: 400 })

  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 })
  if (message.length > MAX_MESSAGE_LENGTH)
    return NextResponse.json(
      { error: `message must be at most ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 },
    )

  if (level !== undefined && !isLogLevel(level))
    return NextResponse.json({ error: "invalid level" }, { status: 400 })
  if (category !== undefined && !CATEGORIES.includes(category))
    return NextResponse.json({ error: "invalid category" }, { status: 400 })

  let metadata: Record<string, unknown> | undefined
  if (body.metadata !== undefined && body.metadata !== null) {
    if (typeof body.metadata !== "object" || Array.isArray(body.metadata))
      return NextResponse.json({ error: "metadata must be an object" }, { status: 400 })

    let serialized: string | undefined
    try {
      serialized = JSON.stringify(body.metadata)
    } catch {
      return NextResponse.json({ error: "metadata is not serializable" }, { status: 400 })
    }
    if (typeof serialized !== "string")
      return NextResponse.json({ error: "metadata is not serializable" }, { status: 400 })
    if (Buffer.byteLength(serialized, "utf8") > MAX_METADATA_BYTES)
      return NextResponse.json({ error: "metadata exceeds 8KB" }, { status: 400 })

    metadata = body.metadata as Record<string, unknown>
  }

  const id = recordActivity({
    workspaceId: ws.id,
    actorId: user.id,
    actorType: "user",
    actorLabel: user.email,
    level: level ?? "info",
    event,
    category: category ?? "api",
    targetType,
    targetId,
    message,
    metadata,
    requestId,
  })

  logger.info("logs.ingest", { requestId, workspaceId: ws.id, event, id })

  return NextResponse.json({ id }, { status: 201 })
}
