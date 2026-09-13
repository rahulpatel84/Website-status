"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import websitesData from "@/data/websites.json"

type Website = {
  id: string
  name: string
  url: string
  category: string
  description?: string
  about?: string
  founded?: string
  headquarters?: string
  socials?: Partial<{
    twitter: string
    linkedin: string
    github: string
    facebook: string
    instagram: string
    youtube: string
  }>
}

const websites = (websitesData as { websites: Website[] }).websites

function initials(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9\s/]/g, " ").trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export default function ServicesPage() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")

  const categories = useMemo(() => {
    const set = new Set<string>()
    websites.forEach((w) => set.add(w.category))
    return Array.from(set).sort()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...websites]
      .filter((w) => {
        if (category !== "all" && w.category !== category) return false
        if (!q) return true
        return (
          w.name.toLowerCase().includes(q) ||
          w.category.toLowerCase().includes(q) ||
          w.url.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [query, category])

  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-10">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
        All monitored services
      </h1>
      <p className="text-lg text-muted-foreground mb-8">
        Search or filter to see live status for any service we monitor.
      </p>

      <div className="flex flex-col md:flex-row gap-3 mb-8">
        <Input
          className="flex-1"
          placeholder="Search services…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          No services match your search.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((w) => (
            <Link
              key={w.id}
              href={`/${w.id}-website-monitor`}
              className="block group"
            >
              <Card className="flex-row items-center gap-4 p-4 hover:border-[color:var(--brand-500)] transition-colors">
                <div className="flex items-center justify-center h-11 w-11 rounded-md bg-[color:var(--brand-50)] text-[color:var(--brand-600)] font-semibold text-sm shrink-0">
                  {initials(w.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold group-hover:text-[color:var(--brand-600)] transition-colors">
                    {w.name}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {w.category} · {hostname(w.url)}
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground shrink-0">
                  <span className="status-dot status-up" />
                  Normal
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="mt-10 p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-semibold mb-1">
              Don&apos;t see a service you care about?
            </h3>
            <p className="text-sm text-muted-foreground">
              Request a new service to monitor — we&apos;ll add popular ones
              within a week.
            </p>
          </div>
          <Link href="/contact">
            <Button className="bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white">
              Request a service
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
