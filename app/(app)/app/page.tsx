import Link from "next/link"
import { Plus, Radio, Activity, AlertTriangle, Gauge } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { StatusPill, StatusDot, type MonitorStatus } from "@/components/monitor/status-pill"
import { UptimeBar, type ProbeStatus } from "@/components/monitor/uptime-bar"

interface MonitorRow {
  id: string
  name: string
  type: string
  target: string
  current_status: string
  last_check_at: string | null
  last_response_ms: number | null
  interval_s: number
  is_paused: number
  updated_at: string
}

interface ProbeRow {
  id: number
  monitor_id: string
  status: string
  response_ms: number | null
  ran_at: string
}

interface IncidentRow {
  id: string
  monitor_id: string
  started_at: string
  resolved_at: string | null
  severity: string
  cause: string | null
  monitor_name?: string | null
}

function toMonitorStatus(s: string, isPaused: number): MonitorStatus {
  if (isPaused) return "paused"
  if (s === "up" || s === "degraded" || s === "down" || s === "pending" || s === "paused")
    return s
  return "pending"
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "—"
  const diff = Date.now() - then
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default async function DashboardPage() {
  const { workspace } = await requireAuth()
  const db = getDatabase()

  const monitors = db
    .prepare(
      `SELECT id, name, type, target, current_status, last_check_at, last_response_ms,
              interval_s, is_paused, updated_at
       FROM monitors WHERE workspace_id = ? ORDER BY updated_at DESC`,
    )
    .all(workspace.id) as MonitorRow[]

  const totalMonitors = monitors.length

  const activeIncidentsRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM incidents WHERE workspace_id = ? AND resolved_at IS NULL`,
    )
    .get(workspace.id) as { c: number }
  const activeIncidents = activeIncidentsRow?.c ?? 0

  // Compute uptime 30d and avg response over probes for this workspace
  const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const probes30d = db
    .prepare(
      `SELECT p.status, p.response_ms
       FROM probes p JOIN monitors m ON m.id = p.monitor_id
       WHERE m.workspace_id = ? AND p.ran_at >= ?`,
    )
    .all(workspace.id, cutoff30d) as { status: string; response_ms: number | null }[]

  let uptime30d = 100
  let avgResponseMs: number | null = null
  if (probes30d.length > 0) {
    const upCount = probes30d.filter((p) => p.status === "up").length
    uptime30d = (upCount / probes30d.length) * 100
    const responses = probes30d
      .map((p) => p.response_ms)
      .filter((v): v is number => typeof v === "number")
    if (responses.length > 0) {
      avgResponseMs = Math.round(
        responses.reduce((a, b) => a + b, 0) / responses.length,
      )
    }
  }

  // Recent monitors (top 6) + last 24 probes each
  const recentMonitors = monitors.slice(0, 6)
  const monitorProbes = new Map<string, ProbeStatus[]>()
  if (recentMonitors.length > 0) {
    const probeStmt = db.prepare(
      `SELECT status FROM probes WHERE monitor_id = ? ORDER BY ran_at DESC LIMIT 24`,
    )
    for (const m of recentMonitors) {
      const rows = probeStmt.all(m.id) as { status: string }[]
      monitorProbes.set(
        m.id,
        rows
          .map((r) => r.status)
          .filter((s): s is ProbeStatus => s === "up" || s === "down" || s === "degraded"),
      )
    }
  }

  // Recent activity — recent incidents + a fallback of recent probe transitions
  const recentIncidents = db
    .prepare(
      `SELECT i.id, i.monitor_id, i.started_at, i.resolved_at, i.severity, i.cause, m.name as monitor_name
       FROM incidents i JOIN monitors m ON m.id = i.monitor_id
       WHERE i.workspace_id = ?
       ORDER BY i.started_at DESC LIMIT 8`,
    )
    .all(workspace.id) as IncidentRow[]

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All monitors across your workspace
          </p>
        </div>
        <div className="flex-1" />
        <Link
          href="/app/incidents"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-input hover:bg-muted text-sm font-medium"
        >
          View incidents
        </Link>
        <Link
          href="/app/monitors/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          New monitor
        </Link>
      </div>

      {/* Empty state */}
      {totalMonitors === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-[color:var(--brand-50)] grid place-items-center">
            <Radio className="w-6 h-6 text-[color:var(--brand-700)]" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Create your first monitor</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            Set up a check for a URL, API, TCP port, SSL cert, DNS record, form flow, or a cron
            heartbeat — we&apos;ll alert you when it fails.
          </p>
          <Link
            href="/app/monitors/new"
            className="mt-5 inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            New monitor
          </Link>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <KpiCard
              label="Total monitors"
              value={String(totalMonitors)}
              icon={<Radio className="w-4 h-4" />}
              detail={`${monitors.filter((m) => !m.is_paused).length} active`}
            />
            <KpiCard
              label="Uptime · 30d"
              value={`${uptime30d.toFixed(2)} %`}
              icon={<Activity className="w-4 h-4" />}
              detail={
                probes30d.length === 0
                  ? "No probe data yet"
                  : `${probes30d.length.toLocaleString()} checks`
              }
            />
            <KpiCard
              label="Active incidents"
              value={String(activeIncidents)}
              icon={<AlertTriangle className="w-4 h-4" />}
              valueClassName={
                activeIncidents > 0 ? "text-[color:var(--status-down)]" : undefined
              }
              detail={activeIncidents === 0 ? "All clear" : "Needs attention"}
            />
            <KpiCard
              label="Avg response"
              value={avgResponseMs === null ? "—" : `${avgResponseMs} ms`}
              icon={<Gauge className="w-4 h-4" />}
              detail="Last 30 days"
            />
          </div>

          {/* Recent monitors */}
          <div className="mt-8 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="text-sm font-semibold">Recent monitors</h2>
              <Link
                href="/app/monitors"
                className="text-xs font-medium text-[color:var(--brand-700)] hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-border">
              {recentMonitors.map((m) => {
                const status = toMonitorStatus(m.current_status, m.is_paused)
                return (
                  <Link
                    key={m.id}
                    href={`/app/monitors/${m.id}`}
                    className="flex flex-wrap sm:grid sm:grid-cols-[16px_1fr_180px_90px_100px_20px] items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <StatusDot status={status} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {m.type.toUpperCase()} · {m.target} · every {m.interval_s}s
                      </div>
                    </div>
                    <div className="w-full sm:w-auto order-last sm:order-none">
                      <UptimeBar statuses={monitorProbes.get(m.id) ?? []} />
                    </div>
                    <div className="text-xs text-muted-foreground hidden sm:block">
                      {m.last_response_ms != null ? `${m.last_response_ms} ms` : "—"}
                    </div>
                    <StatusPill status={status} />
                    <span className="text-muted-foreground text-sm hidden sm:inline">›</span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Recent activity */}
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent activity</h2>
              <Link
                href="/app/incidents"
                className="text-xs font-medium text-[color:var(--brand-700)] hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {recentIncidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No incidents or activity yet. Once your monitors start running you&apos;ll see events here.
                </p>
              ) : (
                recentIncidents.map((i) => {
                  const resolved = !!i.resolved_at
                  return (
                    <div key={i.id} className="flex items-center gap-3 py-1">
                      <StatusDot status={resolved ? "up" : "down"} />
                      <span className="text-sm">
                        <span className="font-medium">{i.monitor_name ?? "Monitor"}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {resolved ? "Recovered" : `Down (${i.severity})`}
                          {i.cause ? ` — ${i.cause}` : ""}
                        </span>
                      </span>
                      <span className="flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {relativeTime(i.resolved_at ?? i.started_at)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  detail,
  icon,
  valueClassName,
}: {
  label: string
  value: string
  detail?: string
  icon?: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {icon}
        {label}
      </div>
      <div
        className={
          "mt-2 text-2xl font-bold tracking-tight " + (valueClassName ?? "text-foreground")
        }
      >
        {value}
      </div>
      {detail ? <div className="text-xs text-muted-foreground mt-1">{detail}</div> : null}
    </div>
  )
}
