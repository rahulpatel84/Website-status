"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"

interface Page {
  id: string
  slug: string
  name: string
  accent_color: string
  visibility: string
  custom_domain: string | null
}
interface Component {
  id: string
  monitor_id: string
  monitor_name: string
  monitor_target: string
  current_status: string
  group_name: string
  display_name: string | null
}
interface MonitorLite {
  id: string
  name: string
  target: string
  current_status: string
}

export function PageEditor({
  page,
  components,
  monitors,
}: {
  page: Page
  components: Component[]
  monitors: MonitorLite[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: page.name,
    accent_color: page.accent_color,
    visibility: page.visibility,
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/status-pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    router.refresh()
  }

  async function addComponent(monitor_id: string) {
    await fetch(`/api/status-pages/${page.id}/components`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monitor_id, group_name: "Services" }),
    })
    router.refresh()
  }

  async function removeComponent(componentId: string) {
    await fetch(`/api/status-pages/${page.id}/components/${componentId}`, {
      method: "DELETE",
    })
    router.refresh()
  }

  const usedIds = new Set(components.map((c) => c.monitor_id))
  const available = monitors.filter((m) => !usedIds.has(m.id))

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
      <aside className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Page info</h3>
          <label className="text-xs text-muted-foreground block mb-1">Name</label>
          <input
            className="w-full h-9 rounded-md border border-input px-3 text-sm mb-3"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <label className="text-xs text-muted-foreground block mb-1">Accent color</label>
          <div className="flex gap-2 items-center mb-3">
            <input
              type="color"
              value={form.accent_color}
              onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
              className="w-10 h-9 rounded border border-input"
            />
            <input
              type="text"
              value={form.accent_color}
              onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
              className="flex-1 h-9 rounded-md border border-input px-3 text-sm font-mono"
            />
          </div>
          <label className="text-xs text-muted-foreground block mb-1">Visibility</label>
          <select
            className="w-full h-9 rounded-md border border-input px-3 text-sm mb-4"
            value={form.visibility}
            onChange={(e) => setForm({ ...form, visibility: e.target.value })}
          >
            <option value="public">Public — anyone can view</option>
            <option value="password">Password protected (soon)</option>
            <option value="team">Team only (soon)</option>
          </select>
          <button
            onClick={save}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] disabled:opacity-60 text-white text-sm font-semibold"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save changes
          </button>
          <p className="text-xs text-muted-foreground mt-3">
            Public URL: <code className="font-mono">/status/{page.slug}</code>
          </p>
        </section>
      </aside>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Components</h3>
        {components.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">
            Add monitors to display on the public status page.
          </p>
        ) : (
          <ul className="space-y-2 mb-4">
            {components.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 py-2 px-3 rounded-md border border-border"
              >
                <span
                  className={
                    "w-2 h-2 rounded-full " +
                    (c.current_status === "up"
                      ? "bg-[color:var(--status-up)]"
                      : c.current_status === "down"
                        ? "bg-[color:var(--status-down)]"
                        : "bg-[color:var(--status-degraded)]")
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {c.display_name || c.monitor_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate font-mono">
                    {c.monitor_target}
                  </div>
                </div>
                <button
                  onClick={() => removeComponent(c.id)}
                  className="text-muted-foreground hover:text-[color:var(--status-down)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 && (
          <div>
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">
              Add a monitor
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {available.map((m) => (
                <button
                  key={m.id}
                  onClick={() => addComponent(m.id)}
                  className="flex items-center gap-3 py-2 px-3 rounded-md border border-dashed border-border hover:border-[color:var(--brand-500)] hover:bg-[color:var(--brand-50)]/40 text-left"
                >
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{m.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.target}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
