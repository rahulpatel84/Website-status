import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { StatusPill, type MonitorStatus } from "@/components/monitor/status-pill"
import { RunsFilters } from "./runs-filters"

interface RunRow {
  probe_id: number | null
  status: string | null
  response_ms: number | null
  http_status: number | null
  layer_failed: string | null
  ran_at: string | null
  shot_id: number | null
  shot_path: string | null
  shot_size: number | null
  shot_taken_at: string | null
  shot_expires_at: string | null
}

const PAGE_SIZE = 10

export default async function AllRunsPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: {
    limit?: string
    from?: string
    to?: string
    status?: string
  }
}) {
  const { workspace } = await requireAuth()
  const db = getDatabase()
  const monitor = db
    .prepare(
      "SELECT id, name, type, target, interval_s FROM monitors WHERE id = ? AND workspace_id = ?",
    )
    .get(params.id, workspace.id) as
    | { id: string; name: string; type: string; target: string; interval_s: number }
    | undefined
  if (!monitor) notFound()

  const limit = Math.max(
    PAGE_SIZE,
    Math.min(500, parseInt(searchParams.limit ?? String(PAGE_SIZE), 10) || PAGE_SIZE),
  )
  const statusFilter = searchParams.status && ["up", "down", "degraded"].includes(searchParams.status)
    ? searchParams.status
    : ""
  const from = validDate(searchParams.from)
  const to = validDate(searchParams.to)

  const where: string[] = ["ps.monitor_id = ?"]
  const args: any[] = [monitor.id]
  if (statusFilter) {
    where.push("p.status = ?")
    args.push(statusFilter)
  }
  if (from) {
    where.push("ps.taken_at >= ?")
    args.push(from + " 00:00:00")
  }
  if (to) {
    where.push("ps.taken_at <= ?")
    args.push(to + " 23:59:59")
  }

  const rows = db
    .prepare(
      `SELECT ps.id AS shot_id, ps.path AS shot_path, ps.size_bytes AS shot_size,
              ps.taken_at AS shot_taken_at, ps.expires_at AS shot_expires_at,
              p.id AS probe_id, p.status, p.response_ms, p.http_status, p.layer_failed,
              p.ran_at
       FROM probe_screenshots ps
       LEFT JOIN probes p ON p.id = ps.probe_id
          OR (p.monitor_id = ps.monitor_id AND ABS(strftime('%s', p.ran_at) - strftime('%s', ps.taken_at)) < 15)
       WHERE ${where.join(" AND ")}
       ORDER BY ps.taken_at DESC
       LIMIT ?`,
    )
    .all(...args, limit) as RunRow[]

  // Total for this filter (for the "shown X of Y" line).
  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS n
         FROM probe_screenshots ps
         LEFT JOIN probes p ON p.id = ps.probe_id
            OR (p.monitor_id = ps.monitor_id AND ABS(strftime('%s', p.ran_at) - strftime('%s', ps.taken_at)) < 15)
         WHERE ${where.join(" AND ")}`,
      )
      .get(...args) as { n: number }
  ).n

  const nextLimit = limit + PAGE_SIZE
  const hasMore = rows.length >= limit && limit < total
  const params2 = new URLSearchParams()
  if (statusFilter) params2.set("status", statusFilter)
  if (from) params2.set("from", from)
  if (to) params2.set("to", to)

  return (
    <div className="max-w-6xl">
      <div className="mb-4">
        <Link
          href={`/app/monitors/${monitor.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to monitor
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">All runs</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono truncate">
            {monitor.name} · {monitor.type.toUpperCase()} · every {monitor.interval_s}s
          </p>
        </div>
        <a
          href={`/api/monitors/${monitor.id}/screenshots/zip`}
          download
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-border bg-card hover:bg-muted text-sm font-semibold shadow-sm text-foreground no-underline"
        >
          ↓ Download all (.zip)
        </a>
      </div>

      <RunsFilters
        initialFrom={from ?? ""}
        initialTo={to ?? ""}
        initialStatus={statusFilter}
      />

      <div className="text-xs text-muted-foreground mb-3">
        Showing {rows.length} of {total} runs
        {statusFilter ? ` · status ${statusFilter}` : ""}
        {from ? ` · from ${from}` : ""}
        {to ? ` · to ${to}` : ""}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No runs match this filter. Try widening the date range or clearing the status filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {rows.map((r) => {
            const kb = Math.round((r.shot_size ?? 0) / 1024)
            const size = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
            const when = r.shot_taken_at ?? r.ran_at ?? ""
            const status = (r.status ?? "up") as MonitorStatus
            return (
              <a
                key={r.shot_id ?? Math.random()}
                href={r.shot_path ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-md overflow-hidden border border-border hover:border-[color:var(--brand-500)] transition-colors bg-card"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.shot_path ?? ""}
                  alt=""
                  loading="lazy"
                  className="w-full h-32 object-cover object-top group-hover:opacity-95"
                />
                <div className="px-2 py-2 text-[10px] text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-2">
                    <StatusPill status={status} />
                    {r.response_ms != null && (
                      <span className="font-mono">{r.response_ms} ms</span>
                    )}
                  </div>
                  <div className="font-mono truncate">{formatWhen(when)}</div>
                  <div className="flex items-center justify-between">
                    <span>{size}</span>
                    {r.shot_expires_at && (
                      <span title={`Expires ${formatWhen(r.shot_expires_at)}`}>
                        exp {formatDate(r.shot_expires_at)}
                      </span>
                    )}
                  </div>
                  {r.layer_failed && (
                    <div className="text-[color:var(--status-down)]">
                      layer: {r.layer_failed}
                    </div>
                  )}
                </div>
              </a>
            )
          })}
        </div>
      )}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Link
            href={
              `/app/monitors/${monitor.id}/runs?limit=${nextLimit}` +
              (params2.toString() ? "&" + params2.toString() : "")
            }
            className="inline-flex items-center gap-2 h-10 px-6 rounded-md border border-border bg-card hover:bg-muted text-sm font-semibold shadow-sm"
          >
            Load more ({Math.min(PAGE_SIZE, total - rows.length)} more)
          </Link>
        </div>
      )}
    </div>
  )
}

function validDate(s: string | undefined): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

function normaliseTs(raw: string): Date {
  if (!raw) return new Date(NaN)
  const s = raw.includes("T") || raw.endsWith("Z") ? raw : raw.replace(" ", "T") + "Z"
  return new Date(s)
}
function formatWhen(raw: string): string {
  const d = normaliseTs(raw)
  return isNaN(d.getTime()) ? raw : d.toLocaleString()
}
function formatDate(raw: string): string {
  const d = normaliseTs(raw)
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString()
}
