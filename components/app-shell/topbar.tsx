"use client"

import Link from "next/link"
import { Activity, Bell, Search } from "lucide-react"
import { MobileNav } from "./mobile-nav"
import { ThemeToggle } from "./theme-toggle"
import { WorkspacePill } from "./workspace-pill"

export function AppTopbar({
  user,
  workspace,
}: {
  user: { name: string; email: string }
  workspace: { name: string; plan: string }
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="h-14 px-4 md:px-6 flex items-center gap-3 md:gap-4">
        <MobileNav workspace={workspace} user={user} />
        <Link href="/app" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[color:var(--brand-500)] grid place-items-center">
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">
            status<span className="text-[color:var(--brand-500)]">.</span>watch
          </span>
        </Link>

        <div className="flex-1 max-w-md hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Search monitors, incidents…"
              className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-card text-sm outline-none focus:border-[color:var(--brand-500)] focus:ring-2 focus:ring-[color:var(--brand-100)]"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <WorkspacePill workspace={workspace} />
          <ThemeToggle />
          <Link
            href="/app/notifications"
            className="p-2 text-muted-foreground hover:text-foreground rounded-md"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  )
}
