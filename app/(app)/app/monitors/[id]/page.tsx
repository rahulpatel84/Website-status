import Link from "next/link"
import { notFound } from "next/navigation"
import { Copy, ExternalLink, AlertTriangle, Info, Pencil } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { StatusPill, type MonitorStatus } from "@/components/monitor/status-pill"
import { UptimeBar, type ProbeStatus } from "@/components/monitor/uptime-bar"
import { DiagnosticWaterfall } from "@/components/monitor/diagnostic-waterfall"
import { RunNowButton } from "@/components/monitor/run-now-button"
import { TestAlertButton } from "@/components/monitor/test-alert-button"
import { NotifyNowButton } from "@/components/monitor/notify-now-button"
import { DeleteMonitorButton } from "@/components/monitor/delete-monitor-button"
import { computeAdvisories, type Advisory } from "@/lib/monitor-engine/advisory"

interface MonitorRow {
  id: string
  workspace_id: string
  name: string
  type: string
  target: string
  method: string
  interval_s: number
  regions: string
  is_paused: number
  current_status: string
  last_check_at: string | null
  last_response_ms: number | null
  created_at: string
}

interface ProbeRow {
  id: number
  status: string
  response_ms: number | null
  http_status: number | null
  layer_failed: string | null
  error: string | null
  ran_at: string
  details: string | null
}

interface IncidentRow {
  id: string
  started_at: string
  resolved_at: string | null
  layer_isolated: string | null
  cause: string | null
  severity: string
}

interface AssertionRow {
  id: string
  kind: string
  op: string
  value: string
}

export default async function MonitorDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { workspace } = await requireAuth()
  const db = getDatabase()
  const monitor = db
    .prepare("SELECT * FROM monitors WHERE id = ? AND workspace_id = ?")
    .get(params.id, workspace.id) as MonitorRow | undefined

  if (!monitor) notFound()

  const probes = db
    .prepare(
      "SELECT id, status, response_ms, http_status, layer_failed, error, ran_at, details FROM probes WHERE monitor_id = ? ORDER BY ran_at DESC LIMIT 100",
    )
    .all(monitor.id) as ProbeRow[]

  const incidents = db
    .prepare(
      "SELECT id, started_at, resolved_at, layer_isolated, cause, severity FROM incidents WHERE monitor_id = ? ORDER BY started_at DESC LIMIT 10",
    )
    .all(monitor.id) as IncidentRow[]

  const assertions = db
    .prepare("SELECT id, kind, op, value FROM assertions WHERE monitor_id = ?")
    .all(monitor.id) as AssertionRow[]

  const shotStats = db
    .prepare(
      `SELECT COUNT(*) AS n,
              COALESCE(SUM(size_bytes), 0) AS bytes,
              MIN(taken_at) AS oldest,
              MIN(expires_at) AS earliest_expiry
       FROM probe_screenshots WHERE monitor_id = ?`,
    )
    .get(monitor.id) as {
    n: number
    bytes: number
    oldest: string | null
    earliest_expiry: string | null
  }

  const allShots = db
    .prepare(
      `SELECT id, path, size_bytes, taken_at, expires_at
       FROM probe_screenshots
       WHERE monitor_id = ?
       ORDER BY taken_at DESC`,
    )
    .all(monitor.id) as {
    id: number
    path: string
    size_bytes: number
    taken_at: string
    expires_at: string
  }[]

  const advisories = await computeAdvisories(monitor.target, monitor.type)

  const status: MonitorStatus = monitor.is_paused
    ? "paused"
    : (monitor.current_status as MonitorStatus)
  const statuses = probes.map((p) => p.status as ProbeStatus)
  const lastFailed = probes.find((p) => p.layer_failed)?.layer_failed ?? null
  const upCount = probes.filter((p) => p.status === "up").length
  const uptime = probes.length > 0 ? Math.round((upCount / probes.length) * 10000) / 100 : 100
  const heartbeatUrl =
    monitor.type === "heartbeat"
      ? `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/heartbeat/${monitor.id}`
      : null

  return (
    <div className="max-w-6xl">
      <div className="mb-4">
        <p className="text-xs text-muted-foreground">
          <Link href="/app/monitors" className="hover:text-foreground">
            Monitors
          </Link>{" "}
          / {monitor.name}
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{monitor.name}</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono truncate">
            {monitor.type.toUpperCase()} · {monitor.target} · every {monitor.interval_s}s
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={status} />
          {status === "down" && <NotifyNowButton monitorId={monitor.id} />}
          <Link
            href={`/app/monitors/${monitor.id}/edit`}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
          <TestAlertButton monitorId={monitor.id} />
          <RunNowButton monitorId={monitor.id} />
          <DeleteMonitorButton id={monitor.id} name={monitor.name} />
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 mb-4">
        <div className="flex items-start gap-6 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              Uptime (last 100 probes)
            </div>
            <div className="text-3xl font-bold text-foreground mt-1">
              {uptime.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {probes.length === 0
                ? "No probes yet — run one to start collecting data."
                : `${probes.length} probes recorded`}
            </div>
          </div>
          <div className="flex-1 min-w-[280px]">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
              Recent probe results
            </div>
            <UptimeBar statuses={statuses} segments={24} className="h-6" />
            <div className="text-xs text-muted-foreground mt-2">
              Avg response:{" "}
              {monitor.last_response_ms != null
                ? `${monitor.last_response_ms} ms`
                : "—"}
              {monitor.last_check_at && ` · Last checked ${new Date(monitor.last_check_at + "Z").toLocaleString()}`}
            </div>
          </div>
        </div>
      </section>

      <AdvisoryCard advisories={advisories} />

      <SecurityCard latestProbeDetails={probes[0]?.details as any} monitorType={monitor.type} />
      <BrowserShotCard
        probes={probes}
        monitorType={monitor.type}
        monitorId={monitor.id}
        shotStats={shotStats}
        allShots={allShots}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4 min-w-0">
          {heartbeatUrl && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-2">
                Heartbeat URL
              </h2>
              <p className="text-xs text-muted-foreground mb-3">
                Hit this URL from your cron/worker at least every {monitor.interval_s} seconds.
                If it goes silent, we alert.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate rounded-md bg-muted px-3 py-2 text-xs font-mono">
                  {heartbeatUrl}
                </code>
                <a
                  href={heartbeatUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="w-3 h-3" /> Test
                </a>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Recent incidents
            </h2>
            {incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No incidents yet.</p>
            ) : (
              <div className="space-y-3">
                {incidents.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-start justify-between gap-4 border-b border-border last:border-b-0 pb-3 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusPill
                          status={i.resolved_at ? "up" : "down"}
                          label={i.resolved_at ? "Resolved" : "Ongoing"}
                        />
                        <span className="text-xs text-muted-foreground">
                          Layer: {i.layer_isolated ?? "—"}
                        </span>
                      </div>
                      <div className="text-sm mt-1 truncate">{i.cause ?? "—"}</div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(i.started_at + "Z").toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Recent probe log
            </h2>
            {probes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing yet. Hit "Run now" to try it.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left py-1.5 font-semibold">When</th>
                      <th className="text-left py-1.5 font-semibold">Status</th>
                      <th className="text-right py-1.5 font-semibold">HTTP</th>
                      <th className="text-right py-1.5 font-semibold">Response</th>
                      <th className="text-left py-1.5 pl-4 font-semibold">Layer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {probes.slice(0, 20).map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(p.ran_at + "Z").toLocaleString()}
                        </td>
                        <td className="py-2">
                          <StatusPill status={p.status as MonitorStatus} />
                        </td>
                        <td className="py-2 text-right font-mono text-xs">
                          {p.http_status ?? "—"}
                        </td>
                        <td className="py-2 text-right font-mono text-xs">
                          {p.response_ms != null ? `${p.response_ms}ms` : "—"}
                        </td>
                        <td className="py-2 pl-4 text-xs text-muted-foreground">
                          {p.layer_failed ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Diagnostic waterfall
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Which layer is causing failures right now.
            </p>
            <DiagnosticWaterfall failedLayer={lastFailed} />
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Assertions
            </h2>
            {assertions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No assertions set.</p>
            ) : (
              <ul className="space-y-2">
                {assertions.map((a) => (
                  <li key={a.id} className="text-xs">
                    <code className="font-mono">
                      {a.kind} {a.op} {a.value}
                    </code>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function SecurityCard({
  latestProbeDetails,
  monitorType,
}: {
  latestProbeDetails: string | undefined | null
  monitorType: string
}) {
  const secTypes = new Set(["security-headers", "ssl-grade", "content-hash"])
  if (!secTypes.has(monitorType) || !latestProbeDetails) return null

  let payload: any = null
  try {
    payload = JSON.parse(latestProbeDetails)
  } catch {
    return null
  }
  const s = payload?.security
  if (!s) return null

  const gradeColor: Record<string, string> = {
    "A+": "text-[color:var(--status-up)] border-[color:var(--status-up)]/30 bg-[color:var(--status-up)]/10",
    A: "text-[color:var(--status-up)] border-[color:var(--status-up)]/30 bg-[color:var(--status-up)]/10",
    B: "text-[color:var(--status-degraded)] border-[color:var(--status-degraded)]/40 bg-[color:var(--status-degraded)]/10",
    C: "text-[color:var(--status-degraded)] border-[color:var(--status-degraded)]/40 bg-[color:var(--status-degraded)]/10",
    D: "text-[color:var(--status-down)] border-[color:var(--status-down)]/40 bg-[color:var(--status-down)]/10",
    F: "text-[color:var(--status-down)] border-[color:var(--status-down)]/40 bg-[color:var(--status-down)]/10",
  }

  const title =
    monitorType === "security-headers"
      ? "Security headers"
      : monitorType === "ssl-grade"
        ? "SSL / TLS"
        : "Content-hash"

  return (
    <section className="rounded-xl border border-border bg-card p-5 mb-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            {title} grade
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span
              className={
                "inline-flex items-center px-3 py-1 rounded-md border font-mono text-lg font-bold " +
                (gradeColor[s.grade] ?? "text-muted-foreground border-border bg-muted")
              }
            >
              {s.grade}
            </span>
            <span className="text-2xl font-bold text-foreground">{s.score} / 100</span>
          </div>
        </div>
        <div className="flex-1 min-w-[280px]">
          {Array.isArray(s.issues) && s.issues.length > 0 ? (
            <>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                Issues to fix
              </div>
              <ul className="space-y-1">
                {s.issues.slice(0, 6).map((issue: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-[color:var(--status-down)]">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="text-sm text-[color:var(--status-up)]">All checks passing — nothing to fix.</div>
          )}
        </div>
      </div>

      {s.details?.cert && (
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">
              Protocol
            </div>
            <div className="font-mono">{s.details.cert.protocol}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">
              Issuer
            </div>
            <div className="truncate">{s.details.cert.issuer}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">
              Valid until
            </div>
            <div>{new Date(s.details.cert.validTo).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">
              Days left
            </div>
            <div
              className={
                s.details.cert.daysUntilExpiry < 14
                  ? "text-[color:var(--status-down)] font-semibold"
                  : s.details.cert.daysUntilExpiry < 30
                    ? "text-[color:var(--status-degraded)] font-semibold"
                    : ""
              }
            >
              {s.details.cert.daysUntilExpiry}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function BrowserShotCard({
  probes,
  monitorType,
  monitorId,
  shotStats,
  allShots,
}: {
  probes: ProbeRow[]
  monitorType: string
  monitorId: string
  shotStats: {
    n: number
    bytes: number
    oldest: string | null
    earliest_expiry: string | null
  }
  allShots: {
    id: number
    path: string
    size_bytes: number
    taken_at: string
    expires_at: string
  }[]
}) {
  if (monitorType !== "form") return null

  const mb = shotStats.bytes / (1024 * 1024)
  const totalSize = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(shotStats.bytes / 1024)} KB`
  const expiryLabel = shotStats.earliest_expiry
    ? new Date(shotStats.earliest_expiry + "Z").toLocaleDateString()
    : null

  const shotProbes = probes
    .map((p) => {
      let parsed: any = null
      try {
        parsed = p.details ? JSON.parse(p.details) : null
      } catch {}
      return { p, browser: parsed?.browser as any }
    })
    .filter((x) => x.browser?.screenshot_path)
    .slice(0, 4)

  if (shotProbes.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card p-6 mb-4">
        <h2 className="text-sm font-semibold mb-1">Browser view</h2>
        <p className="text-xs text-muted-foreground">
          This is a form-check monitor — every run opens a real headless Chromium, verifies the
          page, and captures a screenshot. Hit "Run now" (top-right) to get the first shot.
        </p>
      </section>
    )
  }

  const latest = shotProbes[0]
  return (
    <section className="rounded-xl border border-border bg-card p-5 mb-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="text-sm font-semibold">Browser view</h2>
          {shotStats.n > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {shotStats.n} screenshots · {totalSize} · retained 7 days
              {expiryLabel ? ` (oldest expires ${expiryLabel})` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {shotStats.n > 0 && (
            <a
              href={`/api/monitors/${monitorId}/screenshots/zip`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground shadow-sm no-underline"
              download
            >
              ↓ Download all (.zip)
            </a>
          )}
          <div className="text-xs text-muted-foreground">
            {new Date(latest.p.ran_at + "Z").toLocaleString()}
          </div>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={latest.browser.screenshot_path}
          alt="Latest browser probe screenshot"
          className="w-full h-auto"
        />
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Final URL
          </div>
          <div className="font-mono truncate mt-0.5">{latest.browser.final_url ?? "—"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Status
          </div>
          <div
            className={
              "mt-0.5 " +
              (latest.p.status === "up"
                ? "text-[color:var(--status-up)]"
                : "text-[color:var(--status-down)]")
            }
          >
            {latest.browser.detail}
            {latest.browser.step_failed ? ` · step failed: ${latest.browser.step_failed}` : ""}
          </div>
        </div>
      </div>

      {Array.isArray(latest.browser.console_errors) &&
        latest.browser.console_errors.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
              Console errors ({latest.browser.console_errors.length})
            </div>
            <ul className="text-xs text-[color:var(--status-down)] space-y-1 font-mono">
              {latest.browser.console_errors.slice(0, 4).map((err: string, i: number) => (
                <li key={i} className="truncate">
                  • {err}
                </li>
              ))}
            </ul>
          </div>
        )}

      {allShots.length > 1 && (
        <div className="mt-6 pt-5 border-t border-border">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Recent runs</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Latest 5 shown. Open the full timeline to filter by date and status.
              </p>
            </div>
            <Link
              href={`/app/monitors/${monitorId}/runs`}
              className="text-xs font-semibold text-[color:var(--brand-700)] hover:underline"
            >
              See all {allShots.length} runs →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {allShots.slice(0, 5).map((s) => {
              const kb = Math.round(s.size_bytes / 1024)
              const size = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
              return (
                <a
                  key={s.id}
                  href={s.path}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded-md overflow-hidden border border-border hover:border-[color:var(--brand-500)] transition-colors bg-card"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.path}
                    alt=""
                    loading="lazy"
                    className="w-full h-32 object-cover object-top group-hover:opacity-95"
                  />
                  <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
                    <div className="font-mono truncate">{formatWhen(s.taken_at)}</div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span>{size}</span>
                      <span title={`Expires ${formatWhen(s.expires_at)}`}>
                        exp {formatDate(s.expires_at)}
                      </span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

/** Normalises the SQLite/JS timestamps that come from probe_screenshots. */
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

function AdvisoryCard({ advisories }: { advisories: Advisory[] }) {
  if (!advisories || advisories.length === 0) return null

  const iconFor = (sev: Advisory["severity"]) =>
    sev === "critical" ? AlertTriangle : sev === "warn" ? AlertTriangle : Info

  const colourFor = (sev: Advisory["severity"]) =>
    sev === "critical"
      ? "border-[color:var(--status-down)]/40 bg-[color:var(--status-down)]/10 text-[color:var(--status-down)]"
      : sev === "warn"
        ? "border-[color:var(--status-degraded)]/40 bg-[color:var(--status-degraded)]/10 text-[color:var(--status-degraded)]"
        : "border-border bg-muted/40 text-foreground"

  return (
    <section className="mb-4 space-y-2">
      {advisories.map((a, i) => {
        const Icon = iconFor(a.severity)
        return (
          <div
            key={i}
            className={"rounded-xl border p-4 flex items-start gap-3 " + colourFor(a.severity)}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{a.title}</div>
              <p className="text-xs mt-1 text-muted-foreground">{a.detail}</p>
            </div>
          </div>
        )
      })}
    </section>
  )
}
