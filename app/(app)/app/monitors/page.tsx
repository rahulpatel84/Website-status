import Link from "next/link"
import { Plus, Radio as RadioIcon } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { StatusPill, type MonitorStatus } from "@/components/monitor/status-pill"
import { UptimeBar, type ProbeStatus } from "@/components/monitor/uptime-bar"
import { MonitorRowActions } from "@/components/monitor/monitor-row-actions"
import { MonitorsFilters } from "./monitors-filters"

interface MonitorRow {
  id: string
  name: string
  type: string
  target: string
  interval_s: number
  is_paused: number
  current_status: string
  last_response_ms: number | null
  created_at: string
}

interface Params {
  q?: string
  type?: string
  status?: string
  sort?: string
}

const VALID_SORTS = new Set([
  "created_desc",
  "created_asc",
  "name_asc",
  "name_desc",
  "response_desc",
  "response_asc",
])

function formatWhen(raw: string): string {
  const s = raw.includes("T") || raw.endsWith("Z") ? raw : raw.replace(" ", "T") + "Z"
  const d = new Date(s)
  return isNaN(d.getTime()) ? raw : d.toLocaleString()
}

export default async function MonitorsListPage({
  searchParams,
}: {
  searchParams: Params
}) {
  const { workspace } = await requireAuth()
  const db = getDatabase()

  const q = (searchParams.q ?? "").trim().toLowerCase()
  const typeFilter = (searchParams.type ?? "").trim()
  const statusFilter = (searchParams.status ?? "").trim()
  const sort = VALID_SORTS.has(searchParams.sort ?? "") ? searchParams.sort! : "created_desc"

  const where: string[] = ["workspace_id = ?"]
  const args: any[] = [workspace.id]

  if (q) {
    where.push("(LOWER(name) LIKE ? OR LOWER(target) LIKE ?)")
    args.push(`%${q}%`, `%${q}%`)
  }
  if (typeFilter) {
    where.push("type = ?")
    args.push(typeFilter)
  }
  if (statusFilter === "paused") {
    where.push("is_paused = 1")
  } else if (statusFilter) {
    where.push("is_paused = 0 AND current_status = ?")
    args.push(statusFilter)
  }

  const orderBy = {
    created_desc: "created_at DESC",
    created_asc: "created_at ASC",
    name_asc: "name ASC",
    name_desc: "name DESC",
    response_desc: "last_response_ms DESC NULLS LAST",
    response_asc: "last_response_ms ASC NULLS LAST",
  }[sort]

  const monitors = db
    .prepare(
      `SELECT id, name, type, target, interval_s, is_paused, current_status, last_response_ms, created_at
       FROM monitors
       WHERE ${where.join(" AND ")}
       ORDER BY ${orderBy}`,
    )
    .all(...args) as MonitorRow[]

  const totalInWorkspace = (
    db
      .prepare("SELECT COUNT(*) AS n FROM monitors WHERE workspace_id = ?")
      .get(workspace.id) as { n: number }
  ).n

  const probeStmt = db.prepare(
    "SELECT status FROM probes WHERE monitor_id = ? ORDER BY ran_at DESC LIMIT 24",
  )

  const anyFilter = q || typeFilter || statusFilter || sort !== "created_desc"

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Monitors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {anyFilter ? (
              <>
                {monitors.length} of {totalInWorkspace} monitor
                {totalInWorkspace === 1 ? "" : "s"} matching filters
              </>
            ) : (
              <>
                {totalInWorkspace} {totalInWorkspace === 1 ? "monitor" : "monitors"} in this workspace
              </>
            )}
            .
          </p>
        </div>
        <Link
          href="/app/monitors/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> New monitor
        </Link>
      </div>

      <MonitorsFilters
        initialQ={q}
        initialType={typeFilter}
        initialStatus={statusFilter}
        initialSort={sort}
      />

      {totalInWorkspace === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <RadioIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No monitors yet. Create your first one to start tracking uptime.
          </p>
          <Link
            href="/app/monitors/new"
            className="inline-flex items-center gap-2 mt-4 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Create monitor
          </Link>
        </div>
      ) : monitors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No monitors match this filter. Try a broader search.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_170px_180px_90px_100px_84px] items-center gap-4 px-5 py-3 border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            <div>Monitor</div>
            <div>Uptime · 24 checks</div>
            <div>Created</div>
            <div className="text-right">Response</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>
          {monitors.map((m) => {
            const rows = probeStmt.all(m.id) as { status: string }[]
            const statuses = rows.map((r) => r.status as ProbeStatus)
            const status: MonitorStatus = m.is_paused
              ? "paused"
              : (m.current_status as MonitorStatus)
            return (
              <div
                key={m.id}
                className="flex flex-col gap-3 md:grid md:grid-cols-[1fr_170px_180px_90px_100px_84px] md:gap-4 items-start md:items-center px-4 md:px-5 py-4 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <Link
                  href={`/app/monitors/${m.id}`}
                  className="min-w-0 w-full md:w-auto flex items-center gap-3 md:block hover:opacity-90"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.type.toUpperCase()} · {m.target} · every {m.interval_s}s
                    </div>
                  </div>
                  <div className="md:hidden shrink-0">
                    <StatusPill status={status} />
                  </div>
                </Link>

                <div className="w-full md:w-auto">
                  <UptimeBar statuses={statuses} segments={24} />
                </div>

                <div className="hidden md:block text-xs text-muted-foreground">
                  {formatWhen(m.created_at)}
                </div>

                <div className="hidden md:block text-right text-xs font-mono">
                  {m.last_response_ms != null ? `${m.last_response_ms}ms` : "—"}
                </div>

                <div className="hidden md:block">
                  <StatusPill status={status} />
                </div>

                <div className="hidden md:block">
                  <MonitorRowActions id={m.id} name={m.name} variant="desktop" />
                </div>

                {/* Mobile: edit + delete */}
                <div className="md:hidden flex w-full items-center gap-2 justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatWhen(m.created_at)}
                  </span>
                  <MonitorRowActions id={m.id} name={m.name} variant="mobile" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
