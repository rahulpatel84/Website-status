"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Play } from "lucide-react"

export function RunNowButton({ monitorId }: { monitorId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/probes/run/${monitorId}`, { method: "POST" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || "Failed to run probe")
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-transparent hover:bg-muted text-sm font-medium disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        Run now
      </button>
      {error ? <span className="text-xs text-[color:var(--status-down)]">{error}</span> : null}
    </div>
  )
}
