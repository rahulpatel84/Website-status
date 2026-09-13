"use client"

import Link from "next/link"
import { Settings2 } from "lucide-react"

export function WorkspacePill({
  workspace,
}: {
  workspace: { name: string; plan: string }
}) {
  const initials = workspace.name.slice(0, 2).toUpperCase()
  const planLabel =
    workspace.plan === "hobby" ? "Free" : workspace.plan.replace(/^\w/, (c) => c.toUpperCase())

  return (
    <Link
      href="/app/settings"
      className="hidden md:inline-flex items-center gap-2 h-8 pl-1.5 pr-2.5 rounded-full border border-border bg-card hover:bg-muted transition-colors"
      title="Workspace settings"
    >
      <div className="w-5 h-5 rounded bg-[color:var(--brand-50)] text-[color:var(--brand-700)] grid place-items-center text-[9px] font-bold border border-[color:var(--brand-100)]">
        {initials}
      </div>
      <div className="text-xs font-semibold truncate max-w-[140px]">
        {workspace.name}
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground border-l border-border pl-2">
        {planLabel}
      </span>
      <Settings2 className="w-3 h-3 text-muted-foreground" />
    </Link>
  )
}
