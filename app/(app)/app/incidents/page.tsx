import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertTriangle, Clock, Gauge, TimerReset } from "lucide-react"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { formatDuration } from "@/lib/format-duration"

export const dynamic = "force-dynamic"

interface IncidentRow {
  id: string
  monitor_id: string
  workspace_id: string
  started_at: string
  resolved_at: string | null
  severity: string
  layer_isolated: string | null
  cause: string | null
  acknowledged_by: string | null
  acknowledged_at: string | null
  monitor_name: string
  monitor_type: string
  monitor_target: string
}

type StatusFilter = "all" | "active" | "resolved" | "acknowledged"
type SeverityFilter = "all" | "critical" | "major" | "minor"
type TypeFilter = string

function normalizeStatus(v: string | undefined): StatusFilter {
  if (v === "active" || v === "resolved" || v === "acknowledged") return v
  return "all"
}
function normalizeSeverity(v: string | undefined): SeverityFilter {
  if (v === "critical" || v === "major" || v === "minor") return v
  return "all"
}

function statusOf(inc: IncidentRow): "Active" | "Resolved" | "Acknowledged" {
  if (inc.resolved_at) return "Resolved"
  if (inc.acknowledged_at) return "Acknowledged"
  return "Active"
}

function StatusPill({ label }: { label: "Active" | "Resolved" | "Acknowledged" }) {
  const cls =
    label === "Active"
      ? "bg-[color:var(--status-down)]/10 text-[color:var(--status-down)] border-[color:var(--status-down)]/20"
      : label === "Acknowledged"
        ? "bg-[color:var(--status-degraded)]/10 text-[color:var(--status-degraded)] border-[color:var(--status-degraded)]/20"
        : "bg-[color:var(--status-up)]/10 text-[color:var(--status-up)] border-[color:var(--status-up)]/20"
  const dotCls =
    label === "Active"
      ? "bg-[color:var(--status-down)]"
      : label === "Acknowledged"
        ? "bg-[color:var(--status-degraded)]"
        : "bg-[color:var(--status-up)]"
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium " + cls
      }
    >
      <span className={"h-1.5 w-1.5 rounded-full " + dotCls} />
      {label}
    </span>
  )
}

function fmtStartedAgo(iso: string): string {
  const now = Date.now()
  const t = new Date(iso.includes("T") ? iso : iso + "Z").getTime()
  const diff = Math.max(0, now - t)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`
  const date = new Date(t)
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

interface PageSearchParams {
  status?: string
  severity?: string
  type?: string
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams?: PageSearchParams
}) {
  const user = await currentUser()
  if (!user) redirect("/sign-in")
  const ws = await ensureUserAndWorkspace(user)

  const status = normalizeStatus(searchParams?.status)
  const severity = normalizeSeverity(searchParams?.severity)
  const typeFilter: TypeFilter = searchParams?.type && searchParams.type !== "all" ? searchParams.type : "all"

  const db = getDatabase()

  const conditions: string[] = ["i.workspace_id = ?"]
  const params: (string | number)[] = [ws.id]

  if (status === "active") {
    conditions.push("i.resolved_at IS NULL")
  } else if (status === "resolved") {
    conditions.push("i.resolved_at IS NOT NULL")
  } else if (status === "acknowledged") {
    conditions.push("i.acknowledged_at IS NOT NULL AND i.resolved_at IS NULL")
  }
  if (severity !== "all") {
    conditions.push("i.severity = ?")
    params.push(severity)
  }
  if (typeFilter !== "all") {
    conditions.push("m.type = ?")
    params.push(typeFilter)
  }

  const whereSql = conditions.length ? "WHERE " + conditions.join(" AND ") : ""

  const incidents = db
    .prepare(
      `SELECT i.id, i.monitor_id, i.workspace_id, i.started_at, i.resolved_at,
              i.severity, i.layer_isolated, i.cause, i.acknowledged_by, i.acknowledged_at,
              m.name as monitor_name, m.type as monitor_type, m.target as monitor_target
       FROM incidents i
       JOIN monitors m ON m.id = i.monitor_id
       ${whereSql}
       ORDER BY i.started_at DESC
       LIMIT 200`,
    )
    .all(...params) as IncidentRow[]

  // KPIs
  const activeCount = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM incidents WHERE workspace_id = ? AND resolved_at IS NULL`,
      )
      .get(ws.id) as { c: number }
  ).c

  const last24Count = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM incidents
         WHERE workspace_id = ? AND started_at >= datetime('now','-24 hours')`,
      )
      .get(ws.id) as { c: number }
  ).c

  const mttrRow = db
    .prepare(
      `SELECT AVG((julianday(resolved_at) - julianday(started_at)) * 86400000) as ms
       FROM incidents
       WHERE workspace_id = ?
         AND resolved_at IS NOT NULL
         AND started_at >= datetime('now','-30 days')`,
    )
    .get(ws.id) as { ms: number | null }

  const downtimeRow = db
    .prepare(
      `SELECT SUM((julianday(COALESCE(resolved_at, datetime('now'))) - julianday(started_at)) * 86400000) as ms
       FROM incidents
       WHERE workspace_id = ?
         AND started_at >= datetime('now','-30 days')`,
    )
    .get(ws.id) as { ms: number | null }

  const mttrText = mttrRow.ms && mttrRow.ms > 0 ? formatDuration(mttrRow.ms) : "—"
  const downtimeText = downtimeRow.ms && downtimeRow.ms > 0 ? formatDuration(downtimeRow.ms) : "0s"

  // Distinct monitor types in this workspace (for filter dropdown)
  const monitorTypes = (
    db
      .prepare(`SELECT DISTINCT type FROM monitors WHERE workspace_id = ? ORDER BY type ASC`)
      .all(ws.id) as { type: string }[]
  ).map((r) => r.type)

  const kpis: {
    label: string
    value: string | number
    accent?: boolean
    icon: React.ComponentType<{ className?: string }>
  }[] = [
    { label: "Active", value: activeCount, accent: activeCount > 0, icon: AlertTriangle },
    { label: "Last 24h", value: last24Count, icon: Clock },
    { label: "MTTR · 30d", value: mttrText, icon: TimerReset },
    { label: "Downtime · 30d", value: downtimeText, icon: Gauge },
  ]

  return (
    <div className="max-w-6xl">
      <div className="flex items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Incidents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every incident across your workspace. Filter, acknowledge, and post-mortem.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <div key={k.label} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <Icon
                  className={
                    "w-3.5 h-3.5 " +
                    (k.accent ? "text-[color:var(--brand-500)]" : "text-muted-foreground")
                  }
                />
                {k.label}
              </div>
              <div
                className={
                  "mt-2 text-2xl font-bold " +
                  (k.accent ? "text-[color:var(--brand-600)]" : "text-foreground")
                }
              >
                {k.value}
              </div>
            </div>
          )
        })}
      </div>

      <form className="flex flex-wrap gap-2 mb-4" method="get">
        <select
          name="type"
          defaultValue={typeFilter}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm"
        >
          <option value="all">All types</option>
          {monitorTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          name="severity"
          defaultValue={severity}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-md border border-border bg-card px-3 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
        <button
          type="submit"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium"
        >
          Apply
        </button>
      </form>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {incidents.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)] grid place-items-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="text-sm font-semibold text-foreground">No incidents match your filters</div>
            <p className="text-xs text-muted-foreground mt-1">
              Try clearing the filters above, or wait for your monitors to report.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-semibold">Monitor</th>
                <th className="px-4 py-3 font-semibold">Started</th>
                <th className="px-4 py-3 font-semibold">Duration</th>
                <th className="px-4 py-3 font-semibold">Diagnosis</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => {
                const label = statusOf(inc)
                const duration = inc.resolved_at
                  ? formatDuration({ started_at: inc.started_at, resolved_at: inc.resolved_at })
                  : "ongoing"
                return (
                  <tr key={inc.id} className="border-t border-border">
                    <td className="px-4 py-3.5 align-top">
                      <div className="font-semibold text-foreground">{inc.monitor_name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[240px]">
                        {inc.monitor_target}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs text-muted-foreground whitespace-nowrap">
                      {fmtStartedAgo(inc.started_at)}
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs whitespace-nowrap">
                      {duration === "ongoing" ? (
                        <span className="text-[color:var(--status-down)] font-medium">ongoing</span>
                      ) : (
                        <span className="text-foreground">{duration}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      {inc.layer_isolated ? (
                        <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs">
                          Layer: <b className="ml-1">{inc.layer_isolated}</b>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {inc.cause ? (
                        <div className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                          {inc.cause}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <StatusPill label={label} />
                    </td>
                    <td className="px-4 py-3.5 align-top text-right">
                      <Link
                        href={`/app/monitors/${inc.monitor_id}`}
                        className="text-xs font-medium text-[color:var(--brand-700)] hover:text-[color:var(--brand-600)]"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
