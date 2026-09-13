"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Plus, Send, Trash2 } from "lucide-react"

export function AddChannelForm({
  kind,
  placeholder,
}: {
  kind: "email" | "slack" | "webhook"
  placeholder: string
}) {
  const router = useRouter()
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)

  const configKey =
    kind === "email" ? "to" : kind === "slack" ? "webhook_url" : "url"

  async function submit() {
    if (!value.trim()) return
    setLoading(true)
    try {
      await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          label: value.trim(),
          config: { [configKey]: value.trim() },
        }),
      })
      setValue("")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 h-8 rounded-md border border-input bg-transparent px-3 text-sm"
      />
      <button
        onClick={submit}
        disabled={loading || !value.trim()}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] disabled:opacity-60 text-white text-xs font-semibold"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        Add
      </button>
    </div>
  )
}

export function TestButton({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">("idle")
  async function run() {
    setState("loading")
    try {
      const res = await fetch(`/api/channels/${id}/test`, { method: "POST" })
      setState(res.ok ? "ok" : "err")
    } catch {
      setState("err")
    }
    setTimeout(() => setState("idle"), 2500)
  }
  return (
    <button
      onClick={run}
      className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-input text-xs text-muted-foreground hover:text-foreground"
      disabled={state === "loading"}
    >
      <Send className="w-3 h-3" />
      {state === "idle" && "Test"}
      {state === "loading" && "…"}
      {state === "ok" && "Sent"}
      {state === "err" && "Failed"}
    </button>
  )
}

const CADENCE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Off (initial only)" },
  { value: 5, label: "Every 5 min" },
  { value: 15, label: "Every 15 min" },
  { value: 30, label: "Every 30 min" },
  { value: 60, label: "Every 1 hour" },
  { value: 240, label: "Every 4 hours" },
  { value: 720, label: "Every 12 hours" },
  { value: 1440, label: "Every 24 hours" },
]

export function CadenceSelect({
  id,
  initialValue,
}: {
  id: string
  initialValue: number
}) {
  const router = useRouter()
  const [value, setValue] = useState<number>(initialValue)
  const [state, setState] = useState<"idle" | "saving" | "saved" | "err">("idle")

  async function onChange(next: number) {
    setValue(next)
    setState("saving")
    try {
      const r = await fetch(`/api/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configPatch: { notify_every_min: next } }),
      })
      setState(r.ok ? "saved" : "err")
      if (r.ok) router.refresh()
    } catch {
      setState("err")
    }
    setTimeout(() => setState("idle"), 1500)
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">Renotify</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 rounded-md border border-input bg-transparent px-2 pr-6 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-500)]"
      >
        {CADENCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {state === "saving" && <span className="text-[11px] text-muted-foreground">…</span>}
      {state === "saved" && <span className="text-[11px] text-[color:var(--status-up)]">Saved</span>}
      {state === "err" && <span className="text-[11px] text-[color:var(--status-down)]">Err</span>}
    </div>
  )
}

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  async function del() {
    if (!confirm("Delete this channel?")) return
    setLoading(true)
    await fetch(`/api/channels/${id}`, { method: "DELETE" })
    router.refresh()
  }
  return (
    <button
      onClick={del}
      disabled={loading}
      className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-input text-xs text-muted-foreground hover:text-[color:var(--status-down)]"
    >
      <Trash2 className="w-3 h-3" />
    </button>
  )
}
