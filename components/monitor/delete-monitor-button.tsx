"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Trash2 } from "lucide-react"

/**
 * Header-style delete button for the monitor detail page. Confirms via native
 * dialog, then redirects to the list — the row on the list page disappears
 * when Next re-renders it after nav.
 */
export function DeleteMonitorButton({
  id,
  name,
}: {
  id: string
  name: string
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
      router.push("/app/monitors")
    } catch {
      alert("Delete failed. Check your connection.")
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={del}
      disabled={deleting}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[color:var(--status-down)]/40 text-[color:var(--status-down)] hover:bg-[color:var(--status-down)]/10 text-sm font-medium disabled:opacity-60"
    >
      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      Delete
    </button>
  )
}
