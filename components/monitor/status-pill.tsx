import { cn } from "@/lib/utils"

export type MonitorStatus = "up" | "degraded" | "down" | "paused" | "pending"

const CONFIG: Record<
  MonitorStatus,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  up: {
    label: "Up",
    dot: "bg-[color:var(--status-up)]",
    text: "text-[color:var(--status-up)]",
    bg: "bg-[color:var(--status-up)]/10",
    border: "border-[color:var(--status-up)]/30",
  },
  degraded: {
    label: "Degraded",
    dot: "bg-[color:var(--status-degraded)]",
    text: "text-[color:var(--status-degraded)]",
    bg: "bg-[color:var(--status-degraded)]/10",
    border: "border-[color:var(--status-degraded)]/30",
  },
  down: {
    label: "Down",
    dot: "bg-[color:var(--status-down)]",
    text: "text-[color:var(--status-down)]",
    bg: "bg-[color:var(--status-down)]/10",
    border: "border-[color:var(--status-down)]/30",
  },
  paused: {
    label: "Paused",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
  },
  pending: {
    label: "Pending",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
  },
}

export function StatusPill({
  status,
  label,
  className,
}: {
  status: MonitorStatus
  label?: string
  className?: string
}) {
  const s = CONFIG[status] ?? CONFIG.pending
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        s.bg,
        s.text,
        s.border,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {label ?? s.label}
    </span>
  )
}

export function StatusDot({
  status,
  className,
}: {
  status: MonitorStatus
  className?: string
}) {
  const s = CONFIG[status] ?? CONFIG.pending
  return <span className={cn("inline-block h-2 w-2 rounded-full", s.dot, className)} />
}
