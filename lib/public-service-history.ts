import { randomUUID } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getDatabase } from "@/lib/database"

export type PublicServiceStatus = "up" | "down"
export type PublicHistoryRange = "24h" | "7d" | "30d" | "6m"

export interface PublicServiceCheck {
  serviceSlug: string
  status: PublicServiceStatus
  responseMs: number | null
  httpStatus: number | null
  checkedAt: string
  error: string | null
}

interface StatusRow {
  service_slug: string
  current_status: PublicServiceStatus
  response_ms: number | null
  http_status: number | null
  checked_at: string
  error: string | null
}

interface BucketRow {
  bucket_start: string
  checks: number
  up_checks: number
  down_checks: number
  response_samples: number
  response_ms_total: number
  response_ms_max: number
  latest_status: PublicServiceStatus
  last_http_status: number | null
  last_checked_at: string
}

interface IncidentRow {
  id: string
  started_at: string
  resolved_at: string | null
  cause: string | null
  http_status: number | null
}

const RANGE_CONFIG: Record<
  PublicHistoryRange,
  { milliseconds: number; bucketMinutes: 5 | 60 | 1440 }
> = {
  "24h": { milliseconds: 24 * 60 * 60 * 1000, bucketMinutes: 5 },
  "7d": { milliseconds: 7 * 24 * 60 * 60 * 1000, bucketMinutes: 60 },
  "30d": { milliseconds: 30 * 24 * 60 * 60 * 1000, bucketMinutes: 60 },
  "6m": { milliseconds: 183 * 24 * 60 * 60 * 1000, bucketMinutes: 1440 },
}

let supabase: SupabaseClient | null = null

function useSupabase(): boolean {
  const forced = process.env.PUBLIC_HISTORY_STORE?.toLowerCase()
  if (forced === "sqlite") return false
  if (forced === "supabase") return true

  return (
    process.env.NODE_ENV === "production" &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
}

function getSupabase(): SupabaseClient {
  if (supabase) return supabase

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Public history is configured for Supabase but NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing",
    )
  }

  supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return supabase
}

export function publicHistoryStorageMode(): "sqlite" | "supabase" {
  return useSupabase() ? "supabase" : "sqlite"
}

function bucketStart(iso: string, minutes: number): string {
  const date = new Date(iso)
  const bucketMs = minutes * 60 * 1000
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs).toISOString()
}

function recordSqlite(checks: PublicServiceCheck[]) {
  const db = getDatabase()
  const readState = db.prepare(
    "SELECT current_status FROM public_service_status WHERE service_slug = ?",
  )
  const upsertState = db.prepare(`
    INSERT INTO public_service_status (
      service_slug, current_status, response_ms, http_status, checked_at, error
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(service_slug) DO UPDATE SET
      current_status = excluded.current_status,
      response_ms = excluded.response_ms,
      http_status = excluded.http_status,
      checked_at = excluded.checked_at,
      error = excluded.error
  `)
  const upsertBucket = db.prepare(`
    INSERT INTO public_service_status_buckets (
      service_slug, bucket_start, bucket_minutes, checks, up_checks, down_checks,
      response_samples, response_ms_total, response_ms_max, latest_status,
      last_http_status, last_checked_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(service_slug, bucket_minutes, bucket_start) DO UPDATE SET
      checks = checks + 1,
      up_checks = up_checks + excluded.up_checks,
      down_checks = down_checks + excluded.down_checks,
      response_samples = response_samples + excluded.response_samples,
      response_ms_total = response_ms_total + excluded.response_ms_total,
      response_ms_max = MAX(response_ms_max, excluded.response_ms_max),
      latest_status = excluded.latest_status,
      last_http_status = excluded.last_http_status,
      last_checked_at = excluded.last_checked_at
  `)
  const openIncident = db.prepare(`
    INSERT INTO public_service_incidents (
      id, service_slug, started_at, cause, http_status
    ) VALUES (?, ?, ?, ?, ?)
  `)
  const resolveIncident = db.prepare(`
    UPDATE public_service_incidents
    SET resolved_at = ?
    WHERE id = (
      SELECT id FROM public_service_incidents
      WHERE service_slug = ? AND resolved_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    )
  `)

  const write = db.transaction((rows: PublicServiceCheck[]) => {
    for (const check of rows) {
      const previous = readState.get(check.serviceSlug) as
        | { current_status: PublicServiceStatus }
        | undefined

      if (check.status === "down" && previous?.current_status !== "down") {
        openIncident.run(
          `pub_inc_${randomUUID().slice(0, 16)}`,
          check.serviceSlug,
          check.checkedAt,
          check.error,
          check.httpStatus,
        )
      } else if (check.status === "up" && previous?.current_status === "down") {
        resolveIncident.run(check.checkedAt, check.serviceSlug)
      }

      upsertState.run(
        check.serviceSlug,
        check.status,
        check.responseMs,
        check.httpStatus,
        check.checkedAt,
        check.error,
      )

      for (const minutes of [5, 60, 1440] as const) {
        const hasResponse = check.responseMs !== null
        upsertBucket.run(
          check.serviceSlug,
          bucketStart(check.checkedAt, minutes),
          minutes,
          check.status === "up" ? 1 : 0,
          check.status === "down" ? 1 : 0,
          hasResponse ? 1 : 0,
          check.responseMs ?? 0,
          check.responseMs ?? 0,
          check.status,
          check.httpStatus,
          check.checkedAt,
        )
      }
    }

    db.prepare(
      "DELETE FROM public_service_status_buckets WHERE bucket_minutes = 5 AND bucket_start < datetime('now', '-2 days')",
    ).run()
    db.prepare(
      "DELETE FROM public_service_status_buckets WHERE bucket_minutes = 60 AND bucket_start < datetime('now', '-32 days')",
    ).run()
    db.prepare(
      "DELETE FROM public_service_status_buckets WHERE bucket_minutes = 1440 AND bucket_start < datetime('now', '-183 days')",
    ).run()
    db.prepare(
      "DELETE FROM public_service_incidents WHERE resolved_at IS NOT NULL AND resolved_at < datetime('now', '-183 days')",
    ).run()
  })

  write(checks)
}

export async function recordPublicServiceChecks(checks: PublicServiceCheck[]): Promise<void> {
  if (checks.length === 0) return

  if (!useSupabase()) {
    recordSqlite(checks)
    return
  }

  const payload = checks.map((check) => ({
    service_slug: check.serviceSlug,
    status: check.status,
    response_ms: check.responseMs,
    http_status: check.httpStatus,
    checked_at: check.checkedAt,
    error: check.error,
  }))
  const { error } = await getSupabase().rpc("record_public_service_checks", {
    p_checks: payload,
  })
  if (error) throw new Error(`Could not store public service checks: ${error.message}`)
}

async function getStatus(serviceSlug: string): Promise<StatusRow | null> {
  if (!useSupabase()) {
    return (
      (getDatabase()
        .prepare("SELECT * FROM public_service_status WHERE service_slug = ?")
        .get(serviceSlug) as StatusRow | undefined) ?? null
    )
  }

  const { data, error } = await getSupabase()
    .from("public_service_status")
    .select("service_slug,current_status,response_ms,http_status,checked_at,error")
    .eq("service_slug", serviceSlug)
    .maybeSingle()
  if (error) throw new Error(`Could not read current public service status: ${error.message}`)
  return data as StatusRow | null
}

export async function hasPublicServiceStatus(serviceSlug: string): Promise<boolean> {
  return Boolean(await getStatus(serviceSlug))
}

export async function listDuePublicServices(
  serviceSlugs: string[],
  intervalSeconds: number,
  limit: number,
): Promise<string[]> {
  const latest = new Map<string, number>()

  if (!useSupabase()) {
    if (serviceSlugs.length > 0) {
      const placeholders = serviceSlugs.map(() => "?").join(",")
      const rows = getDatabase()
        .prepare(
          `SELECT service_slug, checked_at FROM public_service_status WHERE service_slug IN (${placeholders})`,
        )
        .all(...serviceSlugs) as { service_slug: string; checked_at: string }[]
      rows.forEach((row) => latest.set(row.service_slug, new Date(row.checked_at).getTime()))
    }
  } else {
    const { data, error } = await getSupabase()
      .from("public_service_status")
      .select("service_slug,checked_at")
    if (error) throw new Error(`Could not schedule public service checks: ${error.message}`)
    for (const row of data ?? []) {
      if (serviceSlugs.includes(row.service_slug)) {
        latest.set(row.service_slug, new Date(row.checked_at).getTime())
      }
    }
  }

  const dueBefore = Date.now() - intervalSeconds * 1000
  return serviceSlugs
    .filter((slug) => (latest.get(slug) ?? 0) <= dueBefore)
    .sort((a, b) => (latest.get(a) ?? 0) - (latest.get(b) ?? 0))
    .slice(0, limit)
}

async function readBuckets(
  serviceSlug: string,
  bucketMinutes: number,
  fromIso: string,
): Promise<BucketRow[]> {
  if (!useSupabase()) {
    return getDatabase()
      .prepare(
        `SELECT bucket_start, checks, up_checks, down_checks, response_samples,
                response_ms_total, response_ms_max, latest_status,
                last_http_status, last_checked_at
         FROM public_service_status_buckets
         WHERE service_slug = ? AND bucket_minutes = ? AND bucket_start >= ?
         ORDER BY bucket_start ASC`,
      )
      .all(serviceSlug, bucketMinutes, fromIso) as BucketRow[]
  }

  const { data, error } = await getSupabase()
    .from("public_service_status_buckets")
    .select(
      "bucket_start,checks,up_checks,down_checks,response_samples,response_ms_total,response_ms_max,latest_status,last_http_status,last_checked_at",
    )
    .eq("service_slug", serviceSlug)
    .eq("bucket_minutes", bucketMinutes)
    .gte("bucket_start", fromIso)
    .order("bucket_start", { ascending: true })
  if (error) throw new Error(`Could not read public service history: ${error.message}`)
  return (data ?? []) as BucketRow[]
}

async function readIncidents(serviceSlug: string, fromMs: number): Promise<IncidentRow[]> {
  let rows: IncidentRow[]
  if (!useSupabase()) {
    rows = getDatabase()
      .prepare(
        `SELECT id, started_at, resolved_at, cause, http_status
         FROM public_service_incidents
         WHERE service_slug = ?
           AND (resolved_at IS NULL OR resolved_at >= ?)
         ORDER BY started_at DESC
         LIMIT 100`,
      )
      .all(serviceSlug, new Date(fromMs).toISOString()) as IncidentRow[]
  } else {
    const { data, error } = await getSupabase()
      .from("public_service_incidents")
      .select("id,started_at,resolved_at,cause,http_status")
      .eq("service_slug", serviceSlug)
      .order("started_at", { ascending: false })
      .limit(100)
    if (error) throw new Error(`Could not read public service incidents: ${error.message}`)
    rows = (data ?? []) as IncidentRow[]
  }

  return rows.filter((row) => !row.resolved_at || new Date(row.resolved_at).getTime() >= fromMs)
}

export async function getPublicServiceHistory(
  serviceSlug: string,
  range: PublicHistoryRange,
) {
  const now = Date.now()
  const config = RANGE_CONFIG[range]
  const fromMs = now - config.milliseconds
  const fromIso = new Date(fromMs).toISOString()
  const [current, buckets, incidents] = await Promise.all([
    getStatus(serviceSlug),
    readBuckets(serviceSlug, config.bucketMinutes, fromIso),
    readIncidents(serviceSlug, fromMs),
  ])

  const totals = buckets.reduce(
    (acc, row) => {
      acc.checks += row.checks
      acc.upChecks += row.up_checks
      acc.downChecks += row.down_checks
      acc.responseSamples += row.response_samples
      acc.responseMsTotal += row.response_ms_total
      acc.maxResponseMs = Math.max(acc.maxResponseMs, row.response_ms_max)
      return acc
    },
    {
      checks: 0,
      upChecks: 0,
      downChecks: 0,
      responseSamples: 0,
      responseMsTotal: 0,
      maxResponseMs: 0,
    },
  )

  return {
    serviceSlug,
    range,
    bucketMinutes: config.bucketMinutes,
    retentionDays: 183,
    current: current
      ? {
          status: current.current_status,
          responseTime: current.response_ms,
          httpStatus: current.http_status,
          checkedAt: current.checked_at,
          error: current.error,
        }
      : null,
    summary: {
      checks: totals.checks,
      upChecks: totals.upChecks,
      downChecks: totals.downChecks,
      uptime: totals.checks > 0 ? (totals.upChecks / totals.checks) * 100 : null,
      averageResponseMs:
        totals.responseSamples > 0
          ? Math.round(totals.responseMsTotal / totals.responseSamples)
          : null,
      maxResponseMs: totals.maxResponseMs || null,
      incidents: incidents.length,
    },
    points: buckets.map((row) => ({
      timestamp: row.bucket_start,
      responseTime:
        row.response_samples > 0 ? Math.round(row.response_ms_total / row.response_samples) : 0,
      status: row.down_checks > 0 ? ("down" as const) : row.latest_status,
      uptime: row.checks > 0 ? (row.up_checks / row.checks) * 100 : 0,
      checks: row.checks,
      downChecks: row.down_checks,
      httpStatus: row.last_http_status,
      checkedAt: row.last_checked_at,
    })),
    incidents: incidents.map((row) => ({
      id: row.id,
      startedAt: row.started_at,
      resolvedAt: row.resolved_at,
      cause: row.cause,
      httpStatus: row.http_status,
    })),
  }
}
