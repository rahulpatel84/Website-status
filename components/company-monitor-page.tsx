"use client"

import { ArrowLeft, ExternalLink, Globe, Calendar, Building, ArrowUpRight, Rss, Mail, Twitter, Linkedin, Github, Facebook, Instagram, Youtube } from "lucide-react"
import Link from "next/link"
import { RealTimeChart } from "./real-time-chart"
import { OutageReporting } from "./outage-reporting"
import { OutageChart } from "./outage-chart"
import { OutageHeatMap } from "./outage-heat-map"
import { CommentsSection } from "./comments-section"
import websitesData from "@/data/websites.json"

interface WebsiteSocials {
  twitter?: string
  linkedin?: string
  github?: string
  facebook?: string
  instagram?: string
  youtube?: string
}

interface Website {
  id: string
  name: string
  url: string
  category: string
  description?: string
  about?: string
  founded?: string
  headquarters?: string
  socials?: WebsiteSocials
}

interface CompanyMonitorPageProps {
  website: Website
}

export function CompanyMonitorPage({ website }: CompanyMonitorPageProps) {
  const related = websitesData.websites
    .filter((w) => w.category === website.category && w.id !== website.id)
    .slice(0, 5)

  const other = websitesData.websites.filter((w) => w.id !== website.id).slice(0, 5)

  const hostname = website.url.replace(/^https?:\/\/(www\.)?/, "")
  const xSearchUrl = `https://x.com/search?q=${encodeURIComponent(
    `#${website.name.replace(/\W/g, "")}Down OR "${website.name.toLowerCase()} down"`,
  )}&f=live`

  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href="/services" className="hover:text-foreground">Services</Link>
        <span>/</span>
        <span className="text-foreground">{website.name}</span>
      </nav>

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-[color:var(--brand-50)] text-[color:var(--brand-700)] grid place-items-center font-bold text-lg shrink-0">
            {website.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Is {website.name} down?
            </h1>
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {website.category} · <a href={website.url} target="_blank" rel="noreferrer" className="hover:text-foreground">{hostname}</a> · Reports from real users, updated live.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={xSearchUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-sm font-medium hover:border-[color:var(--brand-500)]"
          >
            See mentions on X <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
          <Link
            href="#report"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
          >
            I have a problem
          </Link>
        </div>
      </header>

      {/* Back link */}
      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to all services
        </Link>
      </div>

      {/* Layout */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* MAIN */}
        <div className="min-w-0 space-y-6">
          <RealTimeChart
            url={website.url}
            name={website.name}
            serviceSlug={website.id}
            isActive={true}
            onToggle={() => {}}
          />

          <div id="report">
            <OutageReporting companyName={website.name} companySlug={website.id} />
          </div>

          <OutageChart companySlug={website.id} companyName={website.name} />

          <OutageHeatMap companySlug={website.id} companyName={website.name} />

          <CommentsSection companySlug={website.id} companyName={website.name} />
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-4">
          <SidebarCard title="Subscribe">
            <p className="text-xs text-muted-foreground">
              Get notified when reports for {website.name} spike.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                alert("Subscribed — this is a demo endpoint.")
              }}
              className="mt-3 flex flex-col gap-2"
            >
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="h-9 px-3 rounded-md border border-border bg-card text-sm outline-none focus:border-[color:var(--brand-500)] focus:ring-2 focus:ring-[color:var(--brand-100)]"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
              >
                <Mail className="w-3.5 h-3.5" /> Subscribe by email
              </button>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <a className="inline-flex items-center gap-1 hover:text-foreground" href="#">
                  <Rss className="w-3 h-3" /> RSS
                </a>
                <a className="hover:text-foreground" href="/api-docs">Webhook</a>
              </div>
            </form>
          </SidebarCard>

          <SidebarCard title={`About ${website.name}`}>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {website.about ||
                website.description ||
                `${website.name} is a popular online service. This page tracks user-reported outages in real time.`}
            </p>
            <dl className="mt-3 space-y-2 text-xs">
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Globe className="w-3 h-3" /> Website
              </dt>
              <dd>
                <a href={website.url} target="_blank" rel="noreferrer" className="font-mono text-[color:var(--brand-700)] hover:underline break-all">
                  {hostname}
                </a>
              </dd>
              {website.founded && (
                <>
                  <dt className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Founded
                  </dt>
                  <dd className="text-foreground">{website.founded}</dd>
                </>
              )}
              {website.headquarters && (
                <>
                  <dt className="text-muted-foreground flex items-center gap-1.5">
                    <Building className="w-3 h-3" /> Headquarters
                  </dt>
                  <dd className="text-foreground">{website.headquarters}</dd>
                </>
              )}
            </dl>
            <SocialsStrip socials={website.socials} />
          </SidebarCard>

          {related.length > 0 && (
            <SidebarCard title={`More in ${website.category}`}>
              <ul className="space-y-2">
                {related.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/${s.id}-website-monitor`}
                      className="group flex items-center gap-2 text-sm hover:text-[color:var(--brand-700)]"
                    >
                      <span className="w-6 h-6 rounded bg-[color:var(--brand-50)] text-[color:var(--brand-700)] text-[10px] font-bold grid place-items-center shrink-0">
                        {s.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="truncate">{s.name}</span>
                      <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </SidebarCard>
          )}

          <SidebarCard title="Other services">
            <ul className="space-y-2">
              {other.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/${s.id}-website-monitor`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                    <span className="truncate">{s.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/services"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--brand-600)] hover:text-[color:var(--brand-700)]"
            >
              View all services <ArrowUpRight className="w-3 h-3" />
            </Link>
          </SidebarCard>
        </aside>
      </div>
    </div>
  )
}

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </section>
  )
}

function SocialsStrip({ socials }: { socials?: WebsiteSocials }) {
  if (!socials) return null
  type SocialItem = { key: keyof WebsiteSocials; href: string; Icon: typeof Twitter; label: string }
  const items: SocialItem[] = ([
    { key: "twitter", href: socials.twitter, Icon: Twitter, label: "Twitter/X" },
    { key: "linkedin", href: socials.linkedin, Icon: Linkedin, label: "LinkedIn" },
    { key: "github", href: socials.github, Icon: Github, label: "GitHub" },
    { key: "facebook", href: socials.facebook, Icon: Facebook, label: "Facebook" },
    { key: "instagram", href: socials.instagram, Icon: Instagram, label: "Instagram" },
    { key: "youtube", href: socials.youtube, Icon: Youtube, label: "YouTube" },
  ] as Array<{ key: keyof WebsiteSocials; href?: string; Icon: typeof Twitter; label: string }>)
    .filter((i): i is SocialItem => Boolean(i.href))
  if (items.length === 0) return null
  return (
    <div className="mt-4 pt-3 border-t border-border">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        Socials
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {items.map(({ key, href, Icon, label }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            title={label}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
          </a>
        ))}
      </div>
    </div>
  )
}
