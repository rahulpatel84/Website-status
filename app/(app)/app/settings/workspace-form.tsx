"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Check } from "lucide-react"

export function WorkspaceNameForm({
  initialName,
  slug,
  plan,
  role,
}: {
  initialName: string
  slug: string
  plan: string
  role: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)
  const canEdit = role === "owner" || role === "admin"
  const dirty = name.trim() !== initialName.trim()

  async function save() {
    if (!dirty || !canEdit) return
    setState("saving")
    setMessage(null)
    try {
      const r = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setState("error")
        setMessage(j.error || "Failed to save")
        return
      }
      setState("saved")
      router.refresh()
      setTimeout(() => setState("idle"), 1800)
    } catch (e: any) {
      setState("error")
      setMessage(e?.message || "Failed to save")
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Name</label>
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            readOnly={!canEdit}
            className="flex-1 h-9 rounded-md border border-input px-3 text-sm bg-background disabled:opacity-70"
          />
          <button
            onClick={save}
            disabled={!dirty || state === "saving" || !canEdit}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] disabled:opacity-50 text-white text-xs font-semibold"
          >
            {state === "saving" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : state === "saved" ? (
              <Check className="w-3 h-3" />
            ) : null}
            {state === "saved" ? "Saved" : "Save"}
          </button>
        </div>
        {message ? (
          <p className="text-xs text-[color:var(--status-down)] mt-1.5">{message}</p>
        ) : null}
        {!canEdit ? (
          <p className="text-xs text-muted-foreground mt-1.5">
            Only owners and admins can rename the workspace.
          </p>
        ) : null}
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Slug</label>
        <input
          defaultValue={slug}
          readOnly
          className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background opacity-70"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Plan</label>
        <input
          defaultValue={plan}
          readOnly
          className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background opacity-70"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">Your role</label>
        <input
          defaultValue={role}
          readOnly
          className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background opacity-70"
        />
      </div>
    </div>
  )
}
