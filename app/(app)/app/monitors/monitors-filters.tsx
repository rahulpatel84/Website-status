"use client"

import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Search, X } from "lucide-react"

const TYPES = [
  { value: "", label: "All types" },
  { value: "url", label: "URL" },
  { value: "api", label: "API" },
  { value: "form", label: "Form" },
  { value: "port", label: "Port" },
  { value: "ssl", label: "SSL" },
  { value: "dns", label: "DNS" },
  { value: "heartbeat", label: "Heartbeat" },
  { value: "security-headers", label: "Security headers" },
  { value: "ssl-grade", label: "SSL grade" },
  { value: "content-hash", label: "Content hash" },
]

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "up", label: "Up" },
  { value: "down", label: "Down" },
  { value: "degraded", label: "Degraded" },
  { value: "pending", label: "Pending" },
  { value: "paused", label: "Paused" },
]

const SORTS = [
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "name_asc", label: "Name A → Z" },
  { value: "name_desc", label: "Name Z → A" },
  { value: "response_desc", label: "Slowest response" },
  { value: "response_asc", label: "Fastest response" },
]

export function MonitorsFilters({
  initialQ,
  initialType,
  initialStatus,
  initialSort,
}: {
  initialQ: string
  initialType: string
  initialStatus: string
  initialSort: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState(initialQ)
  const [type, setType] = useState(initialType)
  const [status, setStatus] = useState(initialStatus)
  const [sort, setSort] = useState(initialSort)

  // Debounce free-text search
  useEffect(() => {
    const id = setTimeout(() => push({ q, type, status, sort }), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function push(next: { q: string; type: string; status: string; sort: string }) {
    const p = new URLSearchParams()
    if (next.q) p.set("q", next.q)
    if (next.type) p.set("type", next.type)
    if (next.status) p.set("status", next.status)
    if (next.sort && next.sort !== "created_desc") p.set("sort", next.sort)
    router.replace(p.toString() ? `${pathname}?${p.toString()}` : pathname)
  }

  function clear() {
    setQ("")
    setType("")
    setStatus("")
    setSort("created_desc")
    router.replace(pathname)
  }

  const anyActive = Boolean(q || type || status || (sort && sort !== "created_desc"))

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or target…"
          className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-card text-sm outline-none focus:border-[color:var(--brand-500)]"
        />
      </div>
      <select
        value={type}
        onChange={(e) => {
          const v = e.target.value
          setType(v)
          push({ q, type: v, status, sort })
        }}
        className="h-9 rounded-md border border-border bg-card px-3 text-sm"
      >
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => {
          const v = e.target.value
          setStatus(v)
          push({ q, type, status: v, sort })
        }}
        className="h-9 rounded-md border border-border bg-card px-3 text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        value={sort}
        onChange={(e) => {
          const v = e.target.value
          setSort(v)
          push({ q, type, status, sort: v })
        }}
        className="h-9 rounded-md border border-border bg-card px-3 text-sm"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {anyActive && (
        <button
          onClick={clear}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  )
}
