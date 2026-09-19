"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft } from "lucide-react"

// Auto-hides on top-level /app pages. On deeper routes it points at the
// parent segment (e.g. /app/monitors/foo → /app/monitors).
export function BackButton() {
  const pathname = usePathname() || ""
  if (!pathname.startsWith("/app")) return null

  const parts = pathname.split("/").filter(Boolean) // ["app", ...]
  if (parts.length <= 2) return null // /app or /app/monitors — no back

  const parentHref = "/" + parts.slice(0, -1).join("/")
  const parentLabel = humanize(parts[parts.length - 2])

  return (
    <div className="mb-4">
      <Link
        href={parentHref}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Back to {parentLabel}
      </Link>
    </div>
  )
}

function humanize(slug: string) {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
}
