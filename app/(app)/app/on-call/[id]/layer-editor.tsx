"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Plus } from "lucide-react"

interface Layer {
  id: string
  name: string
  rotation_kind: string
  rotation_days: number
  handoff_time: string
  members: string
  layer_order: number
}

interface Member {
  user_id: string
  role: string
  name: string
  email: string
}

export function LayerEditor({
  scheduleId,
  layers,
  members,
}: {
  scheduleId: string
  layers: Layer[]
  members: Member[]
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  async function createLayer() {
    const name = prompt("Layer name?", "Primary")
    if (!name) return
    setCreating(true)
    await fetch(`/api/on-call/schedules/${scheduleId}/layers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        rotation_kind: "weekly",
        rotation_days: 7,
        handoff_time: "09:00",
        members: members.slice(0, 3).map((m) => m.user_id),
      }),
    })
    setCreating(false)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Rotation layers</h2>
        <button
          onClick={createLayer}
          disabled={creating}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5" /> Add layer
        </button>
      </div>

      {layers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No layers yet. Add a rotation layer to define who is on call.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {layers.map((l) => {
            const mems: string[] = safeParseArr(l.members)
            const names = mems
              .map((id) => members.find((m) => m.user_id === id)?.name ?? id.slice(0, 8))
              .join(" → ")
            return (
              <div key={l.id} className="p-5">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-[240px]">
                    <div className="font-semibold text-sm">{l.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Rotates every {l.rotation_days} day{l.rotation_days === 1 ? "" : "s"} · handoff{" "}
                      {l.handoff_time}
                    </div>
                    <div className="text-xs mt-2">
                      <span className="text-muted-foreground">Rotation order: </span>
                      {names || <span className="text-muted-foreground italic">no members</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      On-call now
                    </div>
                    <div className="text-sm font-semibold text-[color:var(--brand-700)] mt-1">
                      {computeCurrent(mems, l.rotation_days, members) ?? "—"}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-border bg-card p-5">
        <div className="text-xs text-muted-foreground">
          Escalation policies (chain layers, add SMS/voice via Twilio, per-step time-outs) hook
          into these rotations. That module is next — the API surface is already in place at{" "}
          <code className="font-mono">/api/on-call/schedules/*</code>.
        </div>
      </div>
    </div>
  )
}

function safeParseArr(s: string): string[] {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/**
 * Naive rotation calculator: which member index is on-call given a rotation
 * length in days and the current UTC date.
 */
function computeCurrent(members: string[], days: number, all: Member[]): string | null {
  if (members.length === 0) return null
  const epoch = Math.floor(Date.now() / (24 * 3600 * 1000))
  const idx = Math.floor(epoch / Math.max(1, days)) % members.length
  const uid = members[idx]
  return all.find((m) => m.user_id === uid)?.name ?? uid.slice(0, 8)
}
