"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

export interface FacetOption {
  value: string
  count: number
}

interface LogFiltersProps {
  /** Base path the filter form navigates to. */
  action: string
  levels: readonly string[]
  categories: readonly string[]
  events: FacetOption[]
  levelCounts: Record<string, number>
  categoryCounts: Record<string, number>
  current: {
    level: string
    category: string
    event: string
    search: string
  }
  /** True when at least one filter is applied — enables "Clear filters". */
  hasFilters: boolean
}

function withCount(label: string, count: number | undefined): string {
  return typeof count === "number" && count > 0 ? `${label} (${count})` : label
}

/**
 * Server-rendered filter bar: a real GET <form> so it works with JS disabled.
 * The only client behaviour is (a) auto-submitting on select change and
 * (b) debouncing the free-text search box. `offset` is intentionally absent
 * from the form so changing a filter resets pagination to page 1.
 */
export function LogFilters({
  action,
  levels,
  categories,
  events,
  levelCounts,
  categoryCounts,
  current,
  hasFilters,
}: LogFiltersProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [search, setSearch] = useState(current.search)

  // Keep the input in sync when the URL changes underneath us (back/forward).
  useEffect(() => {
    setSearch(current.search)
  }, [current.search])

  // Debounced search -> navigate, preserving the other selected filters.
  useEffect(() => {
    if (search === current.search) return
    const id = setTimeout(() => {
      const params = new URLSearchParams()
      if (current.level) params.set("level", current.level)
      if (current.category) params.set("category", current.category)
      if (current.event) params.set("event", current.event)
      if (search.trim()) params.set("search", search.trim())
      const qs = params.toString()
      router.push(qs ? `${action}?${qs}` : action)
    }, 350)
    return () => clearTimeout(id)
  }, [search, current.search, current.level, current.category, current.event, action, router])

  const submitNow = () => formRef.current?.requestSubmit()

  const selectCls =
    "h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-500)]/40"

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      className="flex flex-wrap items-center gap-2 mb-4"
      role="search"
      aria-label="Filter activity logs"
    >
      <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          name="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search messages, events, actors..."
          aria-label="Search activity logs"
          className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-500)]/40"
        />
      </div>

      <select
        name="level"
        key={`level-${current.level}`}
        defaultValue={current.level}
        onChange={submitNow}
        aria-label="Filter by level"
        className={selectCls}
      >
        <option value="">All levels</option>
        {levels.map((l) => (
          <option key={l} value={l}>
            {withCount(l, levelCounts[l])}
          </option>
        ))}
      </select>

      <select
        name="category"
        key={`category-${current.category}`}
        defaultValue={current.category}
        onChange={submitNow}
        aria-label="Filter by category"
        className={selectCls}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {withCount(c, categoryCounts[c])}
          </option>
        ))}
      </select>

      <select
        name="event"
        key={`event-${current.event}`}
        defaultValue={current.event}
        onChange={submitNow}
        aria-label="Filter by event"
        className={selectCls + " max-w-[220px]"}
      >
        <option value="">All events</option>
        {events.map((e) => (
          <option key={e.value} value={e.value}>
            {withCount(e.value, e.count)}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium text-foreground"
      >
        Apply
      </button>

      {hasFilters ? (
        <a
          href={action}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear filters
        </a>
      ) : null}
    </form>
  )
}
