"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  ArrowUpRight,
  AlertTriangle,
  BellRing,
  BookText,
  Bot,
  CalendarClock,
  LayoutDashboard,
  Menu,
  Package,
  Radio,
  ScrollText,
  Settings,
  X,
} from "lucide-react"
import { ProfileBlock } from "./sidebar"

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/assistant", label: "AI Assistant", icon: Bot },
  { href: "/app/monitors", label: "Monitors", icon: Radio },
  { href: "/app/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/app/on-call", label: "On-call", icon: CalendarClock },
  { href: "/app/logs", label: "Logs", icon: ScrollText },
  { href: "/app/status-pages", label: "Status pages", icon: BookText },
  { href: "/app/notifications", label: "Notifications", icon: BellRing },
  { href: "/app/agent", label: "SDK / Agent", icon: Package },
  { href: "/app/settings", label: "Settings", icon: Settings },
]

export function MobileNav({
  workspace,
  user,
}: {
  workspace: { name: string; plan: string }
  user: { name: string; email: string }
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <>
      <button
        className="md:hidden p-2 -ml-2 rounded-md text-foreground hover:bg-muted"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-background border-r border-border p-3 flex flex-col gap-1 overflow-y-auto">
            <div className="flex items-center justify-end px-2 py-2 mb-2">
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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

            <div className="mt-auto pt-4 border-t border-border">
              <div className="px-2 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Plan
              </div>
              <div className="px-2 pb-2 text-xs text-muted-foreground">
                {workspace.plan === "hobby" ? "Free · Hobby" : `Plan · ${workspace.plan}`}
              </div>
              <Link
                href="/pricing"
                className="flex items-center gap-1.5 px-2 py-2 rounded-md text-sm font-semibold text-[color:var(--brand-700)] hover:bg-[color:var(--brand-50)]"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Upgrade
              </Link>
              <div className="mt-3">
                <ProfileBlock user={user} />
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
