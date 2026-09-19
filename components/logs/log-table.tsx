"use client"

import { useState } from "react"
import { ScrollText } from "lucide-react"
import { LogLevelBadge } from "@/components/logs/log-level-badge"
import { LogDetailSheet } from "@/components/logs/log-detail-sheet"

/**
 * Shape of a row from `queryActivityLogs()`. Declared structurally here so this
 * client component never has to import the server-only data layer.
 */
export interface LogRow {
  id: string
  workspace_id: string
  actor_id: string | null
  actor_type: string | null
  actor_label: string | null
  level: string
  event: string
  category: string
  target_type: string | null
  target_id: string | null
  message: string
  metadata: string | null
  request_id: string | null
  ip_hash: string | null
  duration_ms: number | null
  created_at: string
}

function toDate(iso: string): Date {
  return new Date(iso.includes("T") ? iso : iso + "Z")
}

/** Same relative-time voice as the incidents table. */
function fmtRelative(iso: string): string {
  const d = toDate(iso)
  const t = d.getTime()
  if (Number.isNaN(t)) return iso
  const s = Math.floor(Math.max(0, Date.now() - t) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function fmtAbsolute(iso: string): string {
  const d = toDate(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function LogTable({ logs }: { logs: LogRow[] }) {
  const [selected, setSelected] = useState<LogRow | null>(null)

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-10 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)] grid place-items-center">
            <ScrollText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="text-sm font-semibold text-foreground">No logs match your filters</div>
          <p className="text-xs text-muted-foreground mt-1">
            Try clearing the filters above, or wait for your workspace to record activity.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <caption className="sr-only">Workspace activity logs</caption>
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Time</th>
                <th scope="col" className="px-4 py-3 font-semibold">Level</th>
                <th scope="col" className="px-4 py-3 font-semibold">Event</th>
                <th scope="col" className="px-4 py-3 font-semibold">Message</th>
                <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                <th scope="col" className="px-4 py-3 font-semibold">Actor</th>
                <th scope="col" className="px-4 py-3 font-semibold">Target</th>
                <th scope="col" className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="border-t border-border cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <td
                    className="px-4 py-3.5 align-top text-xs text-muted-foreground whitespace-nowrap"
                    title={fmtAbsolute(log.created_at)}
                    suppressHydrationWarning
                  >
                    {fmtRelative(log.created_at)}
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <LogLevelBadge level={log.level} />
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <span className="font-mono text-xs font-semibold text-foreground break-all">
                      {log.event}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <div className="max-w-[320px] truncate text-foreground" title={log.message}>
                      {log.message || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                      {log.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 align-top text-xs">
                    <div className="text-foreground truncate max-w-[160px]">
                      {log.actor_label || log.actor_id || "—"}
                    </div>
                    {log.actor_type ? (
                      <div className="text-muted-foreground">{log.actor_type}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 align-top text-xs">
                    {log.target_type ? (
                      <>
                        <div className="text-foreground">{log.target_type}</div>
                        {log.target_id ? (
                          <div className="text-muted-foreground font-mono truncate max-w-[140px]">
                            {log.target_id}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 align-top text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(log)
                      }}
                      aria-label={`View details for ${log.event} logged at ${log.created_at}`}
                      className="text-xs font-medium text-[color:var(--brand-700)] hover:text-[color:var(--brand-600)] whitespace-nowrap"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <LogDetailSheet log={selected} onClose={() => setSelected(null)} />
    </>
  )
}
