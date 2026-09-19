"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  ScrollText,
  Search,
  X,
} from "lucide-react"
import {
  LOG_LEVELS,
  LOG_SOURCES,
  LogLevelBadge,
  type LogEvent,
  type LogLevel,
  type LogSource,
} from "@/components/logs/log-level-badge"

const PAGE_SIZE = 50
const AUTO_REFRESH_MS = 10_000

type TimeWindow = "1h" | "24h" | "7d" | "30d" | "all"

const TIME_WINDOWS: { value: TimeWindow; label: string; hours: number | null }[] = [
  { value: "1h", label: "Last hour", hours: 1 },
  { value: "24h", label: "Last 24 hours", hours: 24 },
  { value: "7d", label: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "Last 30 days", hours: 24 * 30 },
  { value: "all", label: "All time", hours: null },
]

interface LogsResponse {
  logs: unknown[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

/**
 * Defensive row normalizer.
 *
 * The API is owned by another worker and is still settling: some builds emit
 * `source`, others emit `category`; `metadata` comes back either as a parsed
 * object or as a raw JSON string. Rather than render blank cells when the two
 * drift, coerce whatever arrives into the `LogEvent` shape this UI renders.
 */
function normalizeRow(raw: unknown): LogEvent {
  const r = (raw ?? {}) as Record<string, unknown>

  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null)

  let metadata: Record<string, unknown> | null = null
  const rawMeta = r.metadata
  if (rawMeta && typeof rawMeta === "object") {
    metadata = rawMeta as Record<string, unknown>
  } else if (typeof rawMeta === "string" && rawMeta.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawMeta)
      metadata = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
    } catch {
      metadata = { raw: rawMeta }
    }
  }

  return {
    id: str(r.id) ?? "",
    workspace_id: str(r.workspace_id),
    actor_id: str(r.actor_id),
    actor_label: str(r.actor_label) ?? str(r.actor_type),
    level: (str(r.level) ?? "info") as LogLevel,
    source: (str(r.source) ?? str(r.category) ?? "system") as LogSource,
    event: str(r.event) ?? "",
    message: str(r.message) ?? "",
    target_type: str(r.target_type),
    target_id: str(r.target_id),
    metadata,
    request_id: str(r.request_id),
    ip_hash: str(r.ip_hash),
    duration_ms: typeof r.duration_ms === "number" ? r.duration_ms : null,
    created_at: str(r.created_at) ?? "",
  }
}

/** SQLite hands back "YYYY-MM-DD HH:MM:SS" (UTC); ISO strings pass through. */
function parseTs(iso: string): number {
  if (!iso) return Number.NaN
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z"
  const t = new Date(normalized).getTime()
  return Number.isNaN(t) ? new Date(iso).getTime() : t
}

function fmtAbsolute(iso: string): string {
  const t = parseTs(iso)
  if (Number.isNaN(t)) return iso
  const d = new Date(t)
  const date = d.toLocaleDateString(undefined, { month: "short", day: "2-digit" })
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  return `${date} ${time}`
}

function fmtRelative(iso: string): string {
  const t = parseTs(iso)
  if (Number.isNaN(t)) return ""
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function LogsViewer({
  initialLogs,
  initialTotal,
}: {
  initialLogs: LogEvent[]
  initialTotal: number
}) {
  const [levels, setLevels] = useState<LogLevel[]>([])
  const [source, setSource] = useState<LogSource | "all">("all")
  const [eventFilter, setEventFilter] = useState<string>("")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("24h")

  const [rows, setRows] = useState<LogEvent[]>(initialLogs)
  const [total, setTotal] = useState(initialTotal)
  const [hasMore, setHasMore] = useState(initialLogs.length < initialTotal)

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)

  // Skip the very first fetch: the server already rendered page one.
  const isFirstRun = useRef(true)
  const requestSeq = useRef(0)

  // ---- debounce free-text search (~300ms) ----
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  // ---- filter -> querystring ----
  const filterParams = useMemo(() => {
    const p = new URLSearchParams()
    if (levels.length > 0) p.set("level", levels.join(","))
    if (source !== "all") {
      p.set("source", source)
      // The API has shipped under both names; send both so filtering works
      // regardless of which parser is live. Unknown params are ignored.
      p.set("category", source)
    }
    if (eventFilter) p.set("event", eventFilter)
    if (debouncedSearch) p.set("q", debouncedSearch)
    const win = TIME_WINDOWS.find((w) => w.value === timeWindow)
    if (win?.hours != null) {
      p.set("since", new Date(Date.now() - win.hours * 3600_000).toISOString())
    }
    return p.toString()
  }, [levels, source, eventFilter, debouncedSearch, timeWindow])

  const exportHref = useMemo(() => {
    const p = new URLSearchParams(filterParams)
    return `/api/logs/export${p.toString() ? `?${p.toString()}` : ""}`
  }, [filterParams])

  const fetchPage = useCallback(
    async (offset: number, limit: number, mode: "replace" | "append" | "silent") => {
      const seq = ++requestSeq.current
      if (mode === "append") setLoadingMore(true)
      else if (mode === "replace") setLoading(true)

      try {
        const p = new URLSearchParams(filterParams)
        p.set("limit", String(limit))
        p.set("offset", String(offset))
        const res = await fetch(`/api/logs?${p.toString()}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        const data = (await res.json()) as LogsResponse
        if (seq !== requestSeq.current) return // a newer request already won

        const incoming = (Array.isArray(data.logs) ? data.logs : []).map(normalizeRow)
        setRows((prev) => (mode === "append" ? [...prev, ...incoming] : incoming))
        setTotal(typeof data.total === "number" ? data.total : incoming.length)
        setHasMore(
          typeof data.hasMore === "boolean"
            ? data.hasMore
            : offset + incoming.length < (data.total ?? 0),
        )
        setError(null)
        setLastRefreshed(Date.now())
      } catch (err) {
        if (seq !== requestSeq.current) return
        setError(err instanceof Error ? err.message : "Could not load logs")
      } finally {
        if (seq === requestSeq.current) {
          setLoadingMore(false)
          setLoading(false)
        }
      }
    },
    [filterParams],
  )

  // ---- refetch from the top whenever a filter changes ----
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    setExpandedId(null)
    void fetchPage(0, PAGE_SIZE, "replace")
  }, [fetchPage])

  // Keep the loaded depth in a ref so the poll below can re-fetch exactly as
  // many rows as the user has already paged in, without re-arming the interval
  // on every append.
  const rowsLengthRef = useRef(rows.length)
  useEffect(() => {
    rowsLengthRef.current = rows.length
  }, [rows.length])

  // ---- auto-refresh poll (every 10s while enabled) ----
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => {
      const depth = Math.max(PAGE_SIZE, Math.min(rowsLengthRef.current, 500))
      void fetchPage(0, depth, "silent")
    }, AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [autoRefresh, fetchPage])

  const toggleLevel = (l: LogLevel) =>
    setLevels((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]))

  const clearFilters = () => {
    setLevels([])
    setSource("all")
    setEventFilter("")
    setSearch("")
    setTimeWindow("24h")
  }

  const hasActiveFilters =
    levels.length > 0 || source !== "all" || eventFilter !== "" || search !== "" || timeWindow !== "24h"

  return (
    <div>
      {/* ---------------- Filter bar ---------------- */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-background p-0.5">
            {LOG_LEVELS.map((l) => {
              const active = levels.includes(l)
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => toggleLevel(l)}
                  aria-pressed={active}
                  className={
                    "rounded px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors " +
                    (active
                      ? "bg-[color:var(--brand-500)] text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground")
                  }
                >
                  {l}
                </button>
              )
            })}
          </div>

          <label className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages, events, actors…"
              aria-label="Search logs"
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-[color:var(--brand-500)]"
            />
          </label>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value as LogSource | "all")}
            aria-label="Filter by source"
            className="h-9 rounded-md border border-border bg-card px-3 text-sm"
          >
            <option value="all">All sources</option>
            {LOG_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
            aria-label="Time window"
            className="h-9 rounded-md border border-border bg-card px-3 text-sm"
          >
            {TIME_WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            aria-pressed={autoRefresh}
            className={
              "inline-flex items-center gap-2 h-9 px-3 rounded-md border text-sm font-medium transition-colors " +
              (autoRefresh
                ? "border-[color:var(--brand-200)] bg-[color:var(--brand-50)] text-[color:var(--brand-700)]"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted")
            }
          >
            <RefreshCw className={"w-3.5 h-3.5 " + (autoRefresh ? "animate-spin" : "")} />
            Auto-refresh {autoRefresh ? "on" : "off"}
          </button>

          <button
            type="button"
            onClick={() => void fetchPage(0, Math.max(PAGE_SIZE, rows.length), "replace")}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium"
          >
            Refresh now
          </button>

          <a
            href={exportHref}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </a>

          {eventFilter ? (
            <button
              type="button"
              onClick={() => setEventFilter("")}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[color:var(--brand-200)] bg-[color:var(--brand-50)] font-mono text-xs text-[color:var(--brand-700)]"
            >
              event: {eventFilter}
              <X className="w-3 h-3" />
            </button>
          ) : null}

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          ) : null}

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading
              </span>
            ) : (
              <span>
                {rows.length.toLocaleString()} of {total.toLocaleString()} events
              </span>
            )}
            {lastRefreshed && !loading ? (
              <span className="hidden sm:inline">
                · updated {new Date(lastRefreshed).toLocaleTimeString(undefined, { hour12: false })}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-[color:var(--status-down)]/25 bg-[color:var(--status-down)]/5 p-4 text-sm text-[color:var(--status-down)]">
          {error}
        </div>
      ) : null}

      {/* ---------------- Log table ---------------- */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading && rows.length === 0 ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
                <tr>
                  <th className="px-3 py-2.5 font-semibold w-8" />
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Time</th>
                  <th className="px-3 py-2.5 font-semibold">Level</th>
                  <th className="px-3 py-2.5 font-semibold hidden md:table-cell">Source</th>
                  <th className="px-3 py-2.5 font-semibold hidden lg:table-cell">Event</th>
                  <th className="px-3 py-2.5 font-semibold">Message</th>
                  <th className="px-3 py-2.5 font-semibold hidden xl:table-cell">Actor</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {rows.map((row) => {
                  const open = expandedId === row.id
                  return (
                    <LogRow
                      key={row.id}
                      row={row}
                      open={open}
                      onToggle={() => setExpandedId(open ? null : row.id)}
                      onPickEvent={(e) => setEventFilter(e)}
                      onPickSource={(s) => setSource(s)}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------- Pagination ---------------- */}
      {rows.length > 0 ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          {hasMore ? (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void fetchPage(rows.length, PAGE_SIZE, "append")}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium disabled:opacity-60"
            >
              {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">End of results</span>
          )}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function LogRow({
  row,
  open,
  onToggle,
  onPickEvent,
  onPickSource,
}: {
  row: LogEvent
  open: boolean
  onToggle: () => void
  onPickEvent: (event: string) => void
  onPickSource: (source: LogSource) => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onToggle()
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={open}
        className={
          "border-t border-border cursor-pointer outline-none hover:bg-muted/40 focus-visible:bg-muted/60 " +
          (open ? "bg-muted/40" : "")
        }
      >
        <td className="px-3 py-2 align-top text-muted-foreground">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </td>
        <td className="px-3 py-2 align-top whitespace-nowrap text-muted-foreground">
          <div className="text-foreground">{fmtAbsolute(row.created_at)}</div>
          <div className="text-[10px]">{fmtRelative(row.created_at)}</div>
        </td>
        <td className="px-3 py-2 align-top">
          <LogLevelBadge level={row.level} />
        </td>
        <td className="px-3 py-2 align-top hidden md:table-cell">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPickSource(row.source)
            }}
            className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {row.source}
          </button>
        </td>
        <td className="px-3 py-2 align-top hidden lg:table-cell">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPickEvent(row.event)
            }}
            className="text-[color:var(--brand-700)] hover:underline"
          >
            {row.event}
          </button>
        </td>
        <td className="px-3 py-2 align-top text-foreground">
          <div className="max-w-[520px] truncate" title={row.message}>
            {row.message}
          </div>
          <div className="mt-0.5 flex gap-2 text-[10px] text-muted-foreground lg:hidden">
            <span>{row.source}</span>
            <span>{row.event}</span>
          </div>
        </td>
        <td className="px-3 py-2 align-top hidden xl:table-cell text-muted-foreground">
          <span className="block max-w-[160px] truncate">{row.actor_label ?? "system"}</span>
          {row.duration_ms != null ? (
            <span className="text-[10px]">{fmtDuration(row.duration_ms)}</span>
          ) : null}
        </td>
      </tr>

      {open ? (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={7} className="px-3 py-4">
            <div className="grid gap-4 md:grid-cols-3">
              <DetailList
                items={[
                  ["Event", row.event],
                  ["Source", row.source],
                  ["Target", row.target_type ? `${row.target_type} · ${row.target_id ?? "—"}` : "—"],
                  ["Actor", row.actor_label ?? row.actor_id ?? "system"],
                ]}
              />
              <DetailList
                items={[
                  ["Request ID", row.request_id ?? "—"],
                  ["Log ID", row.id],
                  ["IP hash", row.ip_hash ?? "—"],
                  ["Duration", row.duration_ms != null ? fmtDuration(row.duration_ms) : "—"],
                ]}
              />
              <div className="md:col-span-1">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Metadata
                </div>
                <pre className="max-h-56 overflow-auto rounded-md border border-border bg-background p-2.5 text-[11px] leading-relaxed text-foreground">
                  {row.metadata ? JSON.stringify(row.metadata, null, 2) : "null"}
                </pre>
              </div>
            </div>
            <div className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
              {row.message}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function DetailList({ items }: { items: [string, string][] }) {
  return (
    <dl className="space-y-1.5">
      {items.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="w-[86px] shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pt-0.5">
            {k}
          </dt>
          <dd className="min-w-0 flex-1 break-all text-[11px] text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function LoadingRows() {
  return (
    <div className="divide-y divide-border" aria-busy="true" aria-label="Loading logs">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="h-3 w-14 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)] grid place-items-center">
        <ScrollText className="h-5 w-5" />
      </div>
      <div className="text-sm font-semibold text-foreground">
        {hasFilters ? "No log events match your filters" : "No log events yet"}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {hasFilters
          ? "Try widening the time window or clearing the level and source filters."
          : "Activity from monitors, incidents, notifications and the API will show up here."}
      </p>
      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  )
}
