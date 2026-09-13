"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Save, Trash2 } from "lucide-react"

interface Initial {
  name: string
  type: string
  target: string
  interval_s: number
  is_paused: boolean
  regions: string[]
  config: Record<string, unknown>
}

const REGION_OPTIONS = ["us-east", "eu-central"]
const PRESET_INTERVALS = [30, 60, 300, 900, 1800, 3600, 86400]

function labelForInterval(s: number): string {
  if (s < 60) return `Every ${s} seconds`
  if (s < 3600) {
    const m = s / 60
    return `Every ${m} minute${m === 1 ? "" : "s"}`
  }
  if (s < 86400) {
    const h = s / 3600
    return `Every ${h} hour${h === 1 ? "" : "s"}`
  }
  const d = s / 86400
  return `Every ${d} day${d === 1 ? "" : "s"}`
}

export function EditMonitorForm({ id, initial }: { id: string; initial: Initial }) {
  const router = useRouter()
  const [name, setName] = useState(initial.name)
  const [target, setTarget] = useState(initial.target)
  const [interval_s, setInterval] = useState(initial.interval_s)
  const [isPaused, setIsPaused] = useState(initial.is_paused)
  const [regions, setRegions] = useState<string[]>(initial.regions.length ? initial.regions : ["us-east"])
  const [configJson, setConfigJson] = useState(JSON.stringify(initial.config, null, 2))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  async function save() {
    setError(null)
    if (!name.trim()) return setError("Name is required.")
    if (!target.trim()) return setError("Target is required.")

    let config: unknown = {}
    if (configJson.trim()) {
      try {
        config = JSON.parse(configJson)
        if (typeof config !== "object" || config === null || Array.isArray(config)) {
          return setError("Config must be a JSON object.")
        }
      } catch {
        return setError("Config JSON is invalid.")
      }
    }

    setSaving(true)
    try {
      const r = await fetch(`/api/monitors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          target: target.trim(),
          interval_s: Number(interval_s),
          is_paused: isPaused,
          regions,
          config,
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
      setSavedAt(Date.now())
      router.refresh()
    } catch (e: any) {
      setError(e.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function del() {
    if (!confirm(`Delete monitor "${name}"? This removes all probes, screenshots, and incidents.`))
      return
    setDeleting(true)
    try {
      const r = await fetch(`/api/monitors/${id}`, { method: "DELETE" })
      if (!r.ok) throw new Error("Delete failed")
      router.push("/app/monitors")
    } catch (e: any) {
      setError(e.message || "Delete failed")
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-4">Basics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Target</label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">
              Check interval (seconds)
            </label>
            <div className="flex gap-2">
              <select
                value={PRESET_INTERVALS.includes(interval_s) ? interval_s : "custom"}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === "custom") return
                  setInterval(parseInt(v))
                }}
                className="h-9 rounded-md border border-border bg-card px-3 text-sm"
              >
                {PRESET_INTERVALS.map((s) => (
                  <option key={s} value={s}>
                    {labelForInterval(s)}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              <input
                type="number"
                min={10}
                max={86400}
                value={interval_s}
                onChange={(e) => setInterval(Math.max(10, Math.min(86400, parseInt(e.target.value) || 60)))}
                className="w-24 h-9 rounded-md border border-border bg-card px-3 text-sm font-mono"
                title="Interval in seconds (10 – 86400)"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Min 10s, max 24h. Preset changes fill the number field.
            </p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Regions</label>
            <div className="flex gap-2 flex-wrap">
              {REGION_OPTIONS.map((r) => {
                const active = regions.includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      setRegions((prev) =>
                        prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
                      )
                    }
                    className={
                      "h-9 px-3 rounded-md border text-sm font-medium " +
                      (active
                        ? "border-[color:var(--brand-500)] bg-[color:var(--brand-50)] text-[color:var(--brand-700)]"
                        : "border-border text-muted-foreground hover:text-foreground")
                    }
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPaused}
                onChange={(e) => setIsPaused(e.target.checked)}
              />
              <span>Pause this monitor (no probes will run)</span>
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-1">Config (JSON)</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Type-specific config. For form monitors this holds{" "}
          <code className="font-mono">wait_for_selector, fill, submit_selector,
          expect_selector_after, expect_url_regex_after</code>. For content-hash it
          holds <code className="font-mono">strip_patterns</code>.
        </p>
        <textarea
          value={configJson}
          onChange={(e) => setConfigJson(e.target.value)}
          rows={8}
          spellCheck={false}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-mono"
        />
      </section>

      {error && (
        <div className="rounded-md border border-[color:var(--status-down)]/40 bg-[color:var(--status-down)]/10 text-[color:var(--status-down)] px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {savedAt && !error && (
        <div className="rounded-md border border-[color:var(--status-up)]/40 bg-[color:var(--status-up)]/10 text-[color:var(--status-up)] px-4 py-3 text-sm">
          Saved at {new Date(savedAt).toLocaleTimeString()}.
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={del}
          disabled={deleting}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md border border-[color:var(--status-down)]/40 text-[color:var(--status-down)] hover:bg-[color:var(--status-down)]/10 text-sm font-semibold disabled:opacity-60"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Delete monitor
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 h-9 px-5 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] disabled:opacity-60 text-white text-sm font-semibold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save changes
        </button>
      </div>
    </div>
  )
}
