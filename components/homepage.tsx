"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import websitesData from "@/data/websites.json"
import Link from "next/link"
import { MiniStatusChart } from "./mini-status-chart"

interface Website {
  id: string
  name: string
  url: string
  category: string
  description?: string
  founded?: string
  headquarters?: string
}

export function HomePage() {
  const [query, setQuery] = useState("")

  const sites: Website[] = websitesData.websites
  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sites
    return sites.filter((s) =>
      [s.name, s.url, s.category].some((f) => (f || "").toLowerCase().includes(q)),
    )
  }, [query, sites])

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border bg-gradient-to-b from-white to-red-50">
        <div className="mx-auto max-w-5xl px-4 md:px-6 py-10 md:py-14 text-center">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Real-time outage monitoring</h1>
          <p className="text-sm md:text-base text-gray-600 mb-6">
            Search for a website or service to view live user-reported incidents.
          </p>
          <div className="mx-auto max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search websites and services..."
                className="pl-12 pr-4 h-12 text-base rounded-xl border-2 border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 shadow-sm transition-all"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3 cards per row grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredSites.map((site) => (
          <Link key={site.id} href={`/${site.id}-website-monitor`} className="block">
            <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-gray-300 overflow-hidden">
              <CardHeader className="pb-4 space-y-2">
                <CardTitle className="text-xl font-bold">{site.name}</CardTitle>
                <p className="text-sm text-muted-foreground truncate">{site.url}</p>
              </CardHeader>
              <CardContent className="pb-4">
                <MiniStatusChart companySlug={site.id} name={site.name} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filteredSites.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No websites found matching "{query}"</p>
        </div>
      )}
    </div>
  )
}


