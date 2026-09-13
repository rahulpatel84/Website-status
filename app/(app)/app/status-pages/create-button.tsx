"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Plus } from "lucide-react"

export function CreatePageButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  async function create() {
    setLoading(true)
    try {
      const res = await fetch("/api/status-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: prompt("Status page name?") || "New status page" }),
      })
      const data = await res.json()
      if (data.page?.id) router.push(`/app/status-pages/${data.page.id}`)
      else router.refresh()
    } finally {
      setLoading(false)
    }
  }
  return (
    <button
      onClick={create}
      disabled={loading}
      className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      New status page
    </button>
  )
}
