"use client"

import { useState } from "react"
import { BellRing, Loader2 } from "lucide-react"

export function NotifyNowButton({ monitorId }: { monitorId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "err">("idle")
  const [msg, setMsg] = useState<string | null>(null)

  async function fire() {
    setState("loading")
    setMsg(null)
    try {
      const r = await fetch(`/api/monitors/${monitorId}/notify-now`, { method: "POST" })
      const j = await r.json()
      if (!r.ok || j.ok === false) {
        setState("err")
        setMsg(j.error ?? "Failed")
      } else {
        setState("done")
        setMsg(
          j.channel_count > 0
            ? `Notified ${j.channel_count} channel${j.channel_count === 1 ? "" : "s"}`
            : "No channels configured",
        )
      }
    } catch (e) {
      setState("err")
      setMsg("Network error")
    }
    setTimeout(() => setState("idle"), 8000)
  }

  return (
    <div>
      <button
        type="button"
        onClick={fire}
        disabled={state === "loading"}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-transparent hover:bg-muted text-sm font-medium disabled:opacity-50"
      >
        {state === "loading" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <BellRing className="w-4 h-4" />
        )}
        {state === "done" ? "Notified" : state === "err" ? "Failed" : "Notify now"}
      </button>
      {msg && <div className="mt-2 text-xs text-muted-foreground">{msg}</div>}
    </div>
  )
}
