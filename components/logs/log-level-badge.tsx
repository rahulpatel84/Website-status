import type { ComponentProps } from "react"

// ============================================================
// Shared log vocabulary for the /app/logs UI.
//
// These types mirror the contract exported by `lib/logs.ts`, but are declared
// locally on purpose: `lib/logs.ts` is server-only (it pulls in `node:crypto`
// and better-sqlite3), so a "use client" module must never import its runtime
// values. The shapes are structurally identical, so rows cross the boundary
// without a cast.
// ============================================================

export type LogLevel = "debug" | "info" | "warn" | "error"

export type LogSource =
  | "monitor"
  | "incident"
  | "notification"
  | "api"
  | "auth"
  | "system"
  | "public"

export interface LogEvent {
  id: string
  workspace_id: string | null
  actor_id: string | null
  actor_label: string | null
  level: LogLevel
  source: LogSource
  event: string
  message: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown> | null
  request_id: string | null
  ip_hash: string | null
  duration_ms: number | null
  created_at: string
}

export const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"]

export const LOG_SOURCES: LogSource[] = [
  "monitor",
  "incident",
  "notification",
  "api",
  "auth",
  "system",
  "public",
]

/**
 * Level pill. Mirrors the StatusPill border/bg-10%-opacity pattern used on the
 * incidents page so logs read as the same design language.
 *
 *   error -> --status-down
 *   warn  -> --status-degraded
 *   info  -> brand
 *   debug -> muted
 */
const LEVEL_STYLES: Record<string, { pill: string; dot: string }> = {
  error: {
    pill: "bg-[color:var(--status-down)]/10 text-[color:var(--status-down)] border-[color:var(--status-down)]/20",
    dot: "bg-[color:var(--status-down)]",
  },
  warn: {
    pill: "bg-[color:var(--status-degraded)]/10 text-[color:var(--status-degraded)] border-[color:var(--status-degraded)]/20",
    dot: "bg-[color:var(--status-degraded)]",
  },
  info: {
    pill: "bg-[color:var(--brand-500)]/10 text-[color:var(--brand-700)] border-[color:var(--brand-500)]/20",
    dot: "bg-[color:var(--brand-500)]",
  },
  debug: {
    pill: "bg-muted/60 text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
}

const FALLBACK = LEVEL_STYLES.debug

export function LogLevelBadge({
  level,
  className,
  ...rest
}: { level: string } & Omit<ComponentProps<"span">, "children">) {
  const style = LEVEL_STYLES[level] ?? FALLBACK
  return (
    <span
      {...rest}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize " +
        style.pill +
        (className ? " " + className : "")
      }
    >
      <span className={"h-1.5 w-1.5 rounded-full shrink-0 " + style.dot} />
      {level}
    </span>
  )
}
