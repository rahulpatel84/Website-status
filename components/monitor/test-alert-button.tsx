"use client"

import { useState } from "react"
import { Loader2, Send } from "lucide-react"

interface Result {
  kind: string
  label: string
  ok: boolean
  mocked?: boolean
  error?: string
}

export function TestAlertButton({ monitorId }: { monitorId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "err">("idle")
  const [summary, setSummary] = useState<{
    channel_count: number
    results: Result[]
  } | null>(null)

  async function fire() {
    setState("loading")
    setSummary(null)
    try {
      const r = await fetch(`/api/monitors/${monitorId}/test-alert`, { method: "POST" })
      const j = await r.json()
      setSummary({ channel_count: j.channel_count, results: j.results ?? [] })
      setState(r.ok && j.ok ? "done" : "err")
    } catch (e) {
      setState("err")
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
          <Send className="w-4 h-4" />
        )}
        {state === "done" ? "Sent" : state === "err" ? "Failed" : "Send test alert"}
      </button>
      {summary && (
        <div className="mt-2 text-xs text-muted-foreground">
          {summary.channel_count === 0
            ? "No notification channels set up yet — configure one in Notifications."
            : summary.results.map((r) => (
                <div key={r.kind + r.label} className="flex items-center gap-2">
                  <span
                    className={
                      "w-1.5 h-1.5 rounded-full " +
                      (r.ok
                        ? "bg-[color:var(--status-up)]"
                        : "bg-[color:var(--status-down)]")
                    }
                  />
                  <span>
                    {r.kind} · {r.label}
                    {r.mocked ? " (mocked)" : ""}
                    {r.error ? ` — ${r.error}` : ""}
                  </span>
                </div>
              ))}
        </div>
      )}
    </div>
  )
}
