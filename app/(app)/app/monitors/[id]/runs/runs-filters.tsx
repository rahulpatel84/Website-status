"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"

export function RunsFilters({
  initialFrom,
  initialTo,
  initialStatus,
}: {
  initialFrom: string
  initialTo: string
  initialStatus: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [status, setStatus] = useState(initialStatus)

  function apply() {
    const q = new URLSearchParams()
    if (from) q.set("from", from)
    if (to) q.set("to", to)
    if (status) q.set("status", status)
    // reset limit whenever filters change
    router.push(`${pathname}${q.toString() ? "?" + q.toString() : ""}`)
  }

  function clear() {
    setFrom("")
    setTo("")
    setStatus("")
    router.push(pathname)
  }

  const anyActive = Boolean(from || to || status || params.get("limit"))

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
            From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
            To
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm"
          >
            <option value="">All</option>
            <option value="up">Up</option>
            <option value="degraded">Degraded</option>
            <option value="down">Down</option>
          </select>
        </div>
        <div className="flex items-end gap-2 ml-auto">
          <button
            onClick={apply}
            className="inline-flex items-center h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
          >
            Apply filters
          </button>
          {anyActive && (
            <button
              onClick={clear}
              className="inline-flex items-center h-9 px-4 rounded-md border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
