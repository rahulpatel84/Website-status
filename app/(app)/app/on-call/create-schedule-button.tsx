"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Plus } from "lucide-react"

export function CreateScheduleButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function create() {
    const name = prompt("Schedule name?", "Primary rotation") || "Primary rotation"
    setLoading(true)
    try {
      const res = await fetch("/api/on-call/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      const data = await res.json()
      if (data.id) router.push(`/app/on-call/${data.id}`)
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
      New schedule
    </button>
  )
}
