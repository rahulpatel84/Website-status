import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  TrendingUp,
  TriangleAlert,
} from "lucide-react"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import {
  queryActivityLogs,
  activityLogFacets,
  LOG_LEVELS,
  LOG_CATEGORIES,
} from "@/lib/activity-log"
import { LogTable, type LogRow } from "@/components/logs/log-table"
import { LogFilters } from "@/components/logs/log-filters"

export const dynamic = "force-dynamic"

const BASE_PATH = "/app/logs"
const PAGE_SIZE = 50

type LogLevel = (typeof LOG_LEVELS)[number]
type LogCategory = (typeof LOG_CATEGORIES)[number]

interface PageSearchParams {
  level?: string
  category?: string
  event?: string
  search?: string
  offset?: string
}

/** Only accept values that exist in the canonical vocabulary. */
function pickLevel(v: string | undefined): LogLevel | undefined {
  if (v && (LOG_LEVELS as readonly string[]).includes(v)) return v as LogLevel
  return undefined
}
function pickCategory(v: string | undefined): LogCategory | undefined {
  if (v && (LOG_CATEGORIES as readonly string[]).includes(v)) return v as LogCategory
  return undefined
}
function pickOffset(v: string | undefined): number {
  const n = Number.parseInt(v ?? "", 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Build a `?a=b` string from the active filters, optionally overriding offset. */
function buildQuery(
  filters: { level?: string; category?: string; event?: string; search?: string },
  offset?: number,
): string {
  const params = new URLSearchParams()
  if (filters.level) params.set("level", filters.level)
  if (filters.category) params.set("category", filters.category)
  if (filters.event) params.set("event", filters.event)
  if (filters.search) params.set("search", filters.search)
  if (typeof offset === "number" && offset > 0) params.set("offset", String(offset))
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

function toCountMap(items: { value: string; count: number }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of items) out[item.value] = item.count
  return out
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams?: PageSearchParams
}) {
  const user = await currentUser()
  if (!user) redirect("/sign-in")
  const ws = await ensureUserAndWorkspace(user)

  const level = pickLevel(searchParams?.level)
  const category = pickCategory(searchParams?.category)
  const event = searchParams?.event?.trim() || undefined
  const search = searchParams?.search?.trim() || undefined
  const offset = pickOffset(searchParams?.offset)

  const filters = { level, category, event, search }
  const hasFilters = Boolean(level || category || event || search)

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [page, facets, totalAll, errors24h, warns24h] = await Promise.all([
    queryActivityLogs({
      workspaceId: ws.id,
      level,
      category,
      event,
      search,
      limit: PAGE_SIZE,
      offset,
    }),
    activityLogFacets(ws.id),
    queryActivityLogs({ workspaceId: ws.id, limit: 1, offset: 0 }),
    queryActivityLogs({ workspaceId: ws.id, level: "error", since: since24h, limit: 1, offset: 0 }),
    queryActivityLogs({ workspaceId: ws.id, level: "warn", since: since24h, limit: 1, offset: 0 }),
  ])

  const logs = page.logs as LogRow[]
  const limit = page.limit || PAGE_SIZE
  const eventFacets = [...facets.events].sort((a, b) => b.count - a.count)
  const topEvent = eventFacets[0]

  const rangeFrom = page.total === 0 ? 0 : page.offset + 1
  const rangeTo = page.offset + logs.length

  const prevHref = BASE_PATH + buildQuery(filters, Math.max(0, page.offset - limit))
  const nextHref = BASE_PATH + buildQuery(filters, page.offset + limit)

  const exportQuery = new URLSearchParams({ format: "csv" })
  if (level) exportQuery.set("level", level)
  if (category) exportQuery.set("category", category)
  if (event) exportQuery.set("event", event)
  if (search) exportQuery.set("search", search)
  const exportHref = `/api/logs/export?${exportQuery.toString()}`

  const cards: {
    label: string
    value: string | number
    hint?: string
    accent?: "brand" | "down" | "degraded"
    icon: React.ComponentType<{ className?: string }>
  }[] = [
    { label: "Total events", value: totalAll.total, hint: "All time", icon: Activity },
    {
      label: "Errors · 24h",
      value: errors24h.total,
      hint: "Last 24 hours",
      accent: errors24h.total > 0 ? "down" : undefined,
      icon: AlertTriangle,
    },
    {
      label: "Warnings · 24h",
      value: warns24h.total,
      hint: "Last 24 hours",
      accent: warns24h.total > 0 ? "degraded" : undefined,
      icon: TriangleAlert,
    },
    {
      label: "Top event",
      value: topEvent ? topEvent.value : "—",
      hint: topEvent ? `${topEvent.count} occurrences` : "No activity yet",
      accent: topEvent ? "brand" : undefined,
      icon: TrendingUp,
    },
  ]

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every recorded action across your workspace — monitors, incidents, notifications, auth
            and API calls. Filter, inspect, and export.
          </p>
        </div>
        <a
          href={exportHref}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-card hover:bg-muted text-sm font-semibold text-foreground"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          Export CSV
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => {
          const Icon = c.icon
          const valueCls =
            c.accent === "down"
              ? "text-[color:var(--status-down)]"
              : c.accent === "degraded"
                ? "text-[color:var(--status-degraded)]"
                : c.accent === "brand"
                  ? "text-[color:var(--brand-600)]"
                  : "text-foreground"
          const iconCls =
            c.accent === "down"
              ? "text-[color:var(--status-down)]"
              : c.accent === "degraded"
                ? "text-[color:var(--status-degraded)]"
                : c.accent === "brand"
                  ? "text-[color:var(--brand-500)]"
                  : "text-muted-foreground"
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <Icon className={"w-3.5 h-3.5 shrink-0 " + iconCls} aria-hidden="true" />
                {c.label}
              </div>
              <div
                className={"mt-2 text-2xl font-bold truncate " + valueCls}
                title={String(c.value)}
              >
                {c.value}
              </div>
              {c.hint ? (
                <div className="mt-1 text-xs text-muted-foreground truncate">{c.hint}</div>
              ) : null}
            </div>
          )
        })}
      </div>

      <LogFilters
        action={BASE_PATH}
        levels={LOG_LEVELS}
        categories={LOG_CATEGORIES}
        events={eventFacets}
        levelCounts={toCountMap(facets.levels)}
        categoryCounts={toCountMap(facets.categories)}
        current={{
          level: level ?? "",
          category: category ?? "",
          event: event ?? "",
          search: search ?? "",
        }}
        hasFilters={hasFilters}
      />

      <LogTable logs={logs} />

      {page.total > 0 ? (
        <nav
          className="flex flex-wrap items-center justify-between gap-3 mt-4"
          aria-label="Log pagination"
        >
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Showing <b className="text-foreground">{rangeFrom}</b>–
            <b className="text-foreground">{rangeTo}</b> of{" "}
            <b className="text-foreground">{page.total}</b> events
          </p>
          <div className="flex items-center gap-2">
            {page.offset > 0 ? (
              <Link
                href={prevHref}
                rel="prev"
                aria-label="Previous page of logs"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium text-foreground"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                Previous
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium text-muted-foreground opacity-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                Previous
              </span>
            )}
            {page.hasMore ? (
              <Link
                href={nextHref}
                rel="next"
                aria-label="Next page of logs"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium text-foreground"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium text-muted-foreground opacity-50"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
