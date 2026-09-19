// Format a duration into "Xm Ys" (or "Xh Ym" when >= 1h, "Xs" when < 1m).
// Accepts either a number of milliseconds or a row-like object with
// { started_at, resolved_at? } (SQLite ISO strings).

export interface DurationRow {
  started_at: string
  resolved_at?: string | null
}

function isRow(x: unknown): x is DurationRow {
  return typeof x === "object" && x !== null && "started_at" in (x as Record<string, unknown>)
}

export function formatDuration(msOrRow: number | DurationRow, now: Date = new Date()): string {
  let ms: number
  if (typeof msOrRow === "number") {
    ms = msOrRow
  } else if (isRow(msOrRow)) {
    const start = new Date(msOrRow.started_at.includes("T") ? msOrRow.started_at : msOrRow.started_at + "Z")
    const end = msOrRow.resolved_at
      ? new Date(msOrRow.resolved_at.includes("T") ? msOrRow.resolved_at : msOrRow.resolved_at + "Z")
      : now
    ms = end.getTime() - start.getTime()
  } else {
    return "0s"
  }
  if (!Number.isFinite(ms) || ms < 0) ms = 0
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
