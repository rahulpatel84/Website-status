"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, ArrowRight, Activity, Radio, BellRing } from "lucide-react"
import websitesData from "@/data/websites.json"
import { MiniStatusChart } from "./mini-status-chart"

interface Website {
  id: string
  name: string
  url: string
  category: string
  description?: string
}

// Deterministic pseudo-status per service so the homepage feels alive without being random on every render.
function seedStatus(id: string): "up" | "degraded" | "down" {
  const sum = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  if (id === "instagram") return "down"
  if (id === "twitter") return "degraded"
  if (sum % 11 === 0) return "degraded"
  return "up"
}

const STATUS_LABEL: Record<string, string> = {
  up: "Normal",
  degraded: "Degraded",
  down: "Reports spiking",
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

  const trending = sites
    .map((s) => ({ ...s, status: seedStatus(s.id) }))
    .sort((a, b) => {
      const rank = { down: 0, degraded: 1, up: 2 } as Record<string, number>
      return rank[a.status] - rank[b.status]
    })
    .slice(0, 3)

  return (
    <div>
      {/* HERO */}
      <section className="relative border-b border-border">
        <div className="mx-auto w-full max-w-5xl px-4 md:px-6 py-16 md:py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="status-dot status-up" />
            Live · updates every 30s
          </span>
          <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Is it just you, or is it{" "}
            <span className="text-[color:var(--brand-500)]">down?</span>
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Real-time outage reports from users worldwide. Search any service to see live status,
            incidents, and community reports.
          </p>

          <div className="mt-8 max-w-xl mx-auto">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-sm focus-within:border-[color:var(--brand-500)] focus-within:ring-2 focus-within:ring-[color:var(--brand-100)]">
              <Search className="ml-3 w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Instagram, GitHub, Netflix…"
                className="flex-1 h-10 bg-transparent border-0 outline-none px-1 text-base text-foreground placeholder:text-muted-foreground"
              />
              <button
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold transition-colors"
                onClick={() => {
                  const el = document.getElementById("directory")
                  el?.scrollIntoView({ behavior: "smooth" })
                }}
              >
                Check status
              </button>
            </div>
            <div className="mt-3 flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <span>Popular:</span>
              {sites.slice(0, 4).map((s) => (
                <Link
                  key={s.id}
                  href={`/${s.id}-website-monitor`}
                  className="hover:text-[color:var(--brand-600)] transition-colors"
                >
                  {s.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRENDING OUTAGES */}
      <section className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Trending outages</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Services with the most reports in the last hour.
            </p>
          </div>
          <Link
            href="/services"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-[color:var(--brand-600)] hover:text-[color:var(--brand-700)]"
          >
            All services <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {trending.map((s) => (
            <Link
              key={s.id}
              href={`/${s.id}-website-monitor`}
              className="group block rounded-xl border border-border bg-card p-5 hover:border-[color:var(--brand-500)] hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[color:var(--brand-50)] text-[color:var(--brand-700)] grid place-items-center font-bold text-sm">
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground">{s.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.category} · {s.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </div>
                </div>
                <StatusPill status={s.status} />
              </div>

              <div className="mt-4">
                <MiniStatusChart companySlug={s.id} name={s.name} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* DIRECTORY */}
      <section id="directory" className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              All monitored services
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {sites.length} services ·{" "}
              <Link href="/services" className="text-[color:var(--brand-600)] hover:underline">
                see full directory
              </Link>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredSites.map((site) => {
            const status = seedStatus(site.id)
            return (
              <Link
                key={site.id}
                href={`/${site.id}-website-monitor`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-[color:var(--brand-500)] transition-colors"
              >
                <div className="w-9 h-9 rounded-md bg-[color:var(--brand-50)] text-[color:var(--brand-700)] grid place-items-center font-bold text-xs">
                  {site.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{site.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{site.category}</div>
                </div>
                <span className={`status-dot status-${status}`} aria-label={STATUS_LABEL[status]} />
              </Link>
            )
          })}
        </div>

        {filteredSites.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No services found matching "{query}".
          </div>
        )}
      </section>

      {/* VALUE PROPS */}
      <section className="mx-auto w-full max-w-7xl px-4 md:px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">What we do</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Detect outages fast, understand them clearly, and get notified before your users complain.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ValueCard
            icon={<Radio className="w-4 h-4" />}
            step="01 · Detect"
            title="Crowd-sourced outage detection"
            body="Reports from real users are aggregated in real time and geo-located to spot spikes before the vendor confirms."
          />
          <ValueCard
            icon={<Activity className="w-4 h-4" />}
            step="02 · Visualize"
            title="Heatmap & trend charts"
            body="Every incident gets a live heatmap, a 24-hour report volume chart, and a per-issue breakdown."
          />
          <ValueCard
            icon={<BellRing className="w-4 h-4" />}
            step="03 · Notify"
            title="Subscribe & get alerted"
            body="Email, RSS, or webhook alerts the moment your services show elevated reports."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 md:px-6 pb-16">
        <div className="rounded-xl border border-border bg-[color:var(--brand-50)] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-foreground">Is something down for you?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Report it in one click and help others confirm the outage.
            </p>
          </div>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold transition-colors"
          >
            Report an outage
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}

function StatusPill({ status }: { status: "up" | "degraded" | "down" }) {
  const styles = {
    up: "text-[color:var(--status-up)] border-[color:var(--status-up)]/30",
    degraded: "text-[color:var(--status-degraded)] border-[color:var(--status-degraded)]/40",
    down: "text-[color:var(--status-down)] border-[color:var(--status-down)]/40",
  }[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border bg-card text-xs font-semibold ${styles}`}
    >
      <span className={`status-dot status-${status}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

function ValueCard({
  icon,
  step,
  title,
  body,
}: {
  icon: React.ReactNode
  step: string
  title: string
  body: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)] text-xs font-semibold">
        {icon}
        {step}
      </div>
      <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  )
}
