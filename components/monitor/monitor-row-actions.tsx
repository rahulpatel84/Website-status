"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowRight, Loader2, Pencil, Trash2 } from "lucide-react"

/**
 * Row-level actions for a monitor: Edit, Delete, Open. Rendered from the
 * server-side list page (Server Component → Client Component boundary).
 * Delete uses a native confirm() so we don't have to ship a modal system.
 */
export function MonitorRowActions({
  id,
  name,
  variant = "desktop",
}: {
  id: string
  name: string
  variant?: "desktop" | "mobile"
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function del() {
    if (
      !confirm(
        `Delete monitor "${name}"?\n\nThis permanently removes all its probes, screenshots, and incident history.`,
      )
    )
      return
    setDeleting(true)
    try {
      const r = await fetch(`/api/monitors/${id}`, { method: "DELETE" })
      if (!r.ok) {
        alert("Delete failed. Please try again.")
        setDeleting(false)
        return
      }
      router.refresh()
    } catch {
      alert("Delete failed. Check your connection.")
      setDeleting(false)
    }
  }

  if (variant === "mobile") {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href={`/app/monitors/${id}/edit`}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border text-[11px] font-medium"
        >
          <Pencil className="w-3 h-3" /> Edit
        </Link>
        <button
          onClick={del}
          disabled={deleting}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-[color:var(--status-down)]/40 text-[color:var(--status-down)] text-[11px] font-medium disabled:opacity-60"
          aria-label="Delete monitor"
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/app/monitors/${id}/edit`}
        className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
        title="Edit monitor"
      >
        <Pencil className="w-3 h-3" />
        Edit
      </Link>
      <button
        onClick={del}
        disabled={deleting}
        title="Delete monitor"
        aria-label="Delete monitor"
        className="p-1.5 rounded-md text-muted-foreground hover:text-[color:var(--status-down)] hover:bg-[color:var(--status-down)]/10 disabled:opacity-60"
      >
        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
      <Link
        href={`/app/monitors/${id}`}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
        aria-label="Open monitor"
      >
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}
