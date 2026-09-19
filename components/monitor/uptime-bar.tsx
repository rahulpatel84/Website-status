import { cn } from "@/lib/utils"

export type ProbeStatus = "up" | "down" | "degraded"

/**
 * Renders a horizontal bar of `segments` cells (default 24).
 * `statuses` is an array of most-recent-first probe statuses; oldest fills empty slots.
 */
export function UptimeBar({
  statuses,
  segments = 24,
  className,
  cellClassName,
}: {
  statuses: ProbeStatus[]
  segments?: number
  className?: string
  cellClassName?: string
}) {
  // Fill so we always show `segments` cells. Empty cells sit on the left (older side).
  const filled: (ProbeStatus | null)[] = []
  const src = statuses.slice(0, segments)
  const emptyCount = Math.max(0, segments - src.length)
  for (let i = 0; i < emptyCount; i++) filled.push(null)
  // reverse src so oldest -> newest reads left to right
  for (let i = src.length - 1; i >= 0; i--) filled.push(src[i])

  return (
    <div className={cn("flex items-center gap-[2px] h-4", className)}>
      {filled.map((s, i) => {
        let cls = "bg-muted"
        if (s === "up") cls = "bg-[color:var(--status-up)]"
        else if (s === "degraded") cls = "bg-[color:var(--status-degraded)]"
        else if (s === "down") cls = "bg-[color:var(--status-down)]"
        return (
          <span
            key={i}
            className={cn(
              "flex-1 h-full rounded-[2px] min-w-[3px]",
              cls,
              cellClassName,
            )}
          />
        )
      })}
    </div>
  )
}
