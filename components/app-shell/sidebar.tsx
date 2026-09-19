"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Radio,
  AlertTriangle,
  ScrollText,
  BellRing,
  BookText,
  Settings,
  Package,
  ArrowUpRight,
  CalendarClock,
  Sparkles,
  Bot,
  Newspaper,
} from "lucide-react"
import { SignOutButton } from "./sign-out-button"

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/assistant", label: "AI Assistant", icon: Bot },
  { href: "/app/monitors", label: "Monitors", icon: Radio },
  { href: "/app/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/app/on-call", label: "On-call", icon: CalendarClock },
  { href: "/app/logs", label: "Logs", icon: ScrollText },
  { href: "/app/status-pages", label: "Status pages", icon: BookText },
  { href: "/app/blog", label: "Blog CMS", icon: Newspaper },
  { href: "/app/notifications", label: "Notifications", icon: BellRing },
  { href: "/app/agent", label: "SDK / Agent", icon: Package },
  { href: "/app/plans", label: "Plans", icon: Sparkles },
  { href: "/app/settings", label: "Settings", icon: Settings },
]

export function AppSidebar({
  workspace,
  user,
}: {
  workspace: { name: string; plan: string }
  user: { name: string; email: string }
}) {
  const pathname = usePathname()
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 self-start flex-col gap-1 overflow-hidden border-r border-border bg-background p-3 md:flex md:w-60">
      <nav className="flex flex-col gap-0.5 mt-2">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors " +
                (active
                  ? "bg-[color:var(--brand-50)] text-[color:var(--brand-700)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted")
              }
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-border space-y-3">
        <div>
          <div className="px-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Plan
          </div>
          <div className="px-2 pb-1 text-xs text-muted-foreground">
            {workspace.plan === "hobby" ? "Free · Hobby" : `Plan · ${workspace.plan}`}
          </div>
          <Link
            href="/app/plans"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-semibold text-[color:var(--brand-700)] hover:bg-[color:var(--brand-50)]"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Upgrade
          </Link>
        </div>

        <ProfileBlock user={user} />
        <SignOutButton variant="sidebar" />
      </div>
    </aside>
  )
}

export function ProfileBlock({ user }: { user: { name: string; email: string } }) {
  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return (
    <Link
      href="/app/settings"
      className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted transition-colors border-t border-border pt-3"
      title="Open profile & settings"
    >
      <div className="w-8 h-8 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)] grid place-items-center text-xs font-bold border border-[color:var(--brand-100)] shrink-0">
        {initials || "U"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-foreground truncate">
          {user.name || "You"}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {user.email}
        </div>
      </div>
    </Link>
  )
}
