import { NextResponse } from "next/server"
import { z } from "zod"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import {
  logStats,
  queryLogs,
  LOG_LEVELS,
  LOG_SOURCES,
  type LogLevel,
  type LogSource,
} from "@/lib/logs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const DEFAULT_HOURS = 24
/** 30 days. */
const MAX_HOURS = 720

const querySchema = z
  .object({
    hours: z.coerce
      .number({ invalid_type_error: "must be a number" })
      .int("must be an integer")
      .min(1, "must be >= 1")
      .max(MAX_HOURS, `must be <= ${MAX_HOURS}`)
      .default(DEFAULT_HOURS),
  })
  .strict()

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${String(issue.path[0] ?? "query")}: ${issue.message}`)
}

export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)

  const params = new URL(request.url).searchParams
  const rawHours = params.get("hours")
  const parsed = querySchema.safeParse(
    rawHours !== null && rawHours.trim().length > 0 ? { hours: rawHours.trim() } : {},
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: formatIssues(parsed.error) },
      { status: 400 },
    )
  }

  const windowHours = parsed.data.hours
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

  try {
    // byLevel comes straight from the store's aggregate.
    const byLevel = Object.fromEntries(LOG_LEVELS.map((l) => [l, 0])) as Record<LogLevel, number>
    for (const row of logStats(ws.id, windowHours)) {
      if (row.level in byLevel) byLevel[row.level] = row.count
    }

    // bySource: one counting probe per source (limit 1 — we only read `total`).
    const bySource = Object.fromEntries(LOG_SOURCES.map((s) => [s, 0])) as Record<LogSource, number>
    for (const source of LOG_SOURCES) {
      bySource[source] = queryLogs({
        workspaceId: ws.id,
        sources: [source],
        since,
        limit: 1,
        offset: 0,
      }).total
    }

    const total = queryLogs({ workspaceId: ws.id, since, limit: 1, offset: 0 }).total

    return NextResponse.json(
      { total, byLevel, bySource, windowHours },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to compute log stats"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
