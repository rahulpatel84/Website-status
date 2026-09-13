"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { LogLevelBadge } from "@/components/logs/log-level-badge"
import type { LogRow } from "@/components/logs/log-table"

/**
 * Slide-over detail panel. There is no shadcn Sheet/Dialog in components/ui/
 * (only alert, badge, button, card, chart, input, tabs), so this is a small
 * self-contained, accessible drawer: role="dialog" + aria-modal, Escape to
 * close, focus moved to the panel on open and body scroll locked.
 */
export function LogDetailSheet({ log, onClose }: { log: LogRow | null; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const open = log !== null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    panelRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!log) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close log details"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/40"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Log details for ${log.event}`}
        tabIndex={-1}
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-border bg-card shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <LogLevelBadge level={log.level} />
              <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                {log.category}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-foreground break-words">
              {log.event}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close log details"
            className="shrink-0 grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Block label="Message">
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {log.message || "—"}
            </p>
          </Block>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Actor" value={log.actor_label || log.actor_id || "—"} />
            <Field label="Actor type" value={log.actor_type || "—"} />
            <Field
              label="Target"
              value={log.target_type ? `${log.target_type}${log.target_id ? " · " + log.target_id : ""}` : "—"}
            />
            <Field label="Duration" value={log.duration_ms === null ? "—" : `${log.duration_ms} ms`} />
            <Field label="Request ID" value={log.request_id || "—"} mono />
            <Field label="IP hash" value={log.ip_hash || "—"} mono />
            <Field label="Log ID" value={log.id} mono />
            <Field label="Workspace" value={log.workspace_id} mono />
          </dl>

          <Block label="Timestamp">
            <div className="text-sm text-foreground">{formatAbsolute(log.created_at)}</div>
            <div className="text-xs text-muted-foreground mt-0.5 font-mono break-all">
              {log.created_at}
            </div>
          </Block>

          <Block label="Metadata">
            <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-foreground font-mono whitespace-pre-wrap break-words">
              {prettyJson(log.metadata)}
            </pre>
          </Block>
        </div>
      </div>
    </div>
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
        {label}
      </h3>
      {children}
    </section>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </dt>
      <dd
        className={
          "mt-0.5 text-sm text-foreground break-all " + (mono ? "font-mono text-xs" : "")
        }
      >
        {value}
      </dd>
    </div>
  )
}

function prettyJson(raw: string | null): string {
  if (!raw) return "—"
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso + "Z")
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
