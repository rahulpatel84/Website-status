"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Copy, Loader2, Plus, Trash2 } from "lucide-react"

interface KeyRow {
  id: string
  label: string
  prefix: string
  last_used_at: string | null
  created_at: string
}

export function KeyManager({ keys }: { keys: KeyRow[] }) {
  const router = useRouter()
  const [newLabel, setNewLabel] = useState("")
  const [loading, setLoading] = useState(false)
  const [justCreated, setJustCreated] = useState<{ label: string; token: string } | null>(
    null,
  )

  async function create() {
    if (!newLabel.trim()) return
    setLoading(true)
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      })
      const data = await res.json()
      setJustCreated({ label: data.label, token: data.token })
      setNewLabel("")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this key? Any client using it will start failing.")) return
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" })
    router.refresh()
  }

  return (
    <div>
      {justCreated && (
        <div className="rounded-lg border border-[color:var(--brand-500)]/40 bg-[color:var(--brand-50)] p-4 mb-4">
          <div className="text-sm font-semibold text-[color:var(--brand-700)] mb-2">
            Your new key "{justCreated.label}" — copy it now, you won't see it again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-md bg-card border border-[color:var(--brand-500)]/30 px-3 py-2 text-xs font-mono">
              {justCreated.token}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(justCreated.token)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-card text-sm font-medium"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <button
              onClick={() => setJustCreated(null)}
              className="inline-flex items-center h-9 px-3 rounded-md text-sm text-muted-foreground"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">No keys yet.</p>
      ) : (
        <ul className="space-y-1.5 mb-4">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex items-center gap-3 border border-border rounded-md px-3 py-2 text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{k.label}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {k.prefix}••••••••••••
                </div>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {k.last_used_at
                  ? `used ${new Date(k.last_used_at + "Z").toLocaleDateString()}`
                  : "never used"}
              </div>
              <button
                onClick={() => del(k.id)}
                className="text-muted-foreground hover:text-[color:var(--status-down)]"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New key label (e.g. acme-prod)"
          className="flex-1 h-9 rounded-md border border-input px-3 text-sm"
        />
        <button
          onClick={create}
          disabled={loading || !newLabel.trim()}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] disabled:opacity-60 text-white text-sm font-semibold"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create key
        </button>
      </div>
    </div>
  )
}
