"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import { ArrowRight, Loader2, Plus } from "lucide-react"
import {
  MONITOR_TYPES,
  TypeTile,
  AssertionRow,
  type AssertionInput,
  type MonitorType,
} from "@/components/monitor/monitor-form"

export default function NewMonitorPage() {
  const router = useRouter()
  const [type, setType] = useState<MonitorType>("url")
  const [name, setName] = useState("")
  const [target, setTarget] = useState("")
  const [interval_s, setInterval] = useState(60)
  const [regions, setRegions] = useState<string[]>(["us-east"])
  const [assertions, setAssertions] = useState<AssertionInput[]>([
    { kind: "status_code", op: "eq", value: "200" },
  ])
  const [formConfig, setFormConfig] = useState({
    wait_for_selector: "",
    fill_json: "",
    submit_selector: "",
    expect_selector_after: "",
    expect_url_regex_after: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const typeMeta = MONITOR_TYPES.find((t) => t.type === type)!

  async function submit() {
    setError(null)
    if (!name.trim()) return setError("Give the monitor a name.")
    if (!target.trim()) return setError(`${typeMeta.targetLabel} is required.`)
    setSubmitting(true)
    try {
      const config: Record<string, unknown> = {}
      if (type === "form") {
        if (formConfig.wait_for_selector.trim())
          config.wait_for_selector = formConfig.wait_for_selector.trim()
        if (formConfig.submit_selector.trim())
          config.submit_selector = formConfig.submit_selector.trim()
        if (formConfig.expect_selector_after.trim())
          config.expect_selector_after = formConfig.expect_selector_after.trim()
        if (formConfig.expect_url_regex_after.trim())
          config.expect_url_regex_after = formConfig.expect_url_regex_after.trim()
        if (formConfig.fill_json.trim()) {
          try {
            config.fill = JSON.parse(formConfig.fill_json)
          } catch {
            setSubmitting(false)
            return setError("Fill fields JSON is invalid.")
          }
        }
      }

      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          target: target.trim(),
          interval_s,
          regions,
          assertions,
          config,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const id = data.monitor?.id
      router.push(id ? `/app/monitors/${id}` : "/app/monitors")
    } catch (e: any) {
      setError(e.message || "Something went wrong.")
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground">
          <Link href="/app/monitors" className="hover:text-foreground">
            Monitors
          </Link>{" "}
          / New
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
          Create a new monitor
        </h1>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)]">
            Step 1
          </span>
          <h3 className="text-sm font-semibold">What do you want to monitor?</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MONITOR_TYPES.map((t) => (
            <TypeTile
              key={t.type}
              type={t.type}
              title={t.title}
              description={t.description}
              selected={type === t.type}
              onClick={() => setType(t.type)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)]">
            Step 2
          </span>
          <h3 className="text-sm font-semibold">Configure the check</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Friendly name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. acme.io landing"
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">
              {typeMeta.targetLabel}
            </label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={typeMeta.targetPlaceholder}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Check interval</label>
            <select
              value={interval_s}
              onChange={(e) => setInterval(parseInt(e.target.value))}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value={30}>Every 30 seconds (Pro)</option>
              <option value={60}>Every 60 seconds</option>
              <option value={300}>Every 5 minutes</option>
              <option value={1800}>Every 30 minutes</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Regions</label>
            <div className="flex gap-2 flex-wrap">
              {["us-east", "eu-central"].map((r) => {
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
                        : "border-input text-muted-foreground hover:text-foreground")
                    }
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {type === "form" && (
        <section className="rounded-xl border border-border bg-card p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)]">
              Form check
            </span>
            <h3 className="text-sm font-semibold">What the browser should do</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Wait for this CSS selector to appear <span className="text-muted-foreground">(page-load assertion)</span>
              </label>
              <input
                value={formConfig.wait_for_selector}
                onChange={(e) =>
                  setFormConfig((s) => ({ ...s, wait_for_selector: e.target.value }))
                }
                placeholder="e.g. form#login, [data-testid=hero]"
                className="w-full h-9 rounded-md border border-input px-3 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Fill fields (JSON — selector → value)
              </label>
              <textarea
                rows={4}
                value={formConfig.fill_json}
                onChange={(e) => setFormConfig((s) => ({ ...s, fill_json: e.target.value }))}
                placeholder={`{\n  "input[name=email]": "demo@example.com",\n  "input[name=password]": "test123"\n}`}
                className="w-full rounded-md border border-input px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Click this after fill <span className="text-muted-foreground">(submit)</span>
              </label>
              <input
                value={formConfig.submit_selector}
                onChange={(e) =>
                  setFormConfig((s) => ({ ...s, submit_selector: e.target.value }))
                }
                placeholder="e.g. button[type=submit]"
                className="w-full h-9 rounded-md border border-input px-3 text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  After submit — expect this selector
                </label>
                <input
                  value={formConfig.expect_selector_after}
                  onChange={(e) =>
                    setFormConfig((s) => ({ ...s, expect_selector_after: e.target.value }))
                  }
                  placeholder="e.g. .thank-you, #dashboard"
                  className="w-full h-9 rounded-md border border-input px-3 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  After submit — URL must match this regex
                </label>
                <input
                  value={formConfig.expect_url_regex_after}
                  onChange={(e) =>
                    setFormConfig((s) => ({ ...s, expect_url_regex_after: e.target.value }))
                  }
                  placeholder="e.g. /dashboard|/success"
                  className="w-full h-9 rounded-md border border-input px-3 text-sm font-mono"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Leave fields empty to skip that step. Every run captures a screenshot you can view on
              the monitor page.
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)]">
            Step 3
          </span>
          <h3 className="text-sm font-semibold">Assertions (what "up" means)</h3>
        </div>
        <div className="space-y-2">
          {assertions.map((a, i) => (
            <AssertionRow
              key={i}
              assertion={a}
              onChange={(next) =>
                setAssertions((prev) => prev.map((x, idx) => (idx === i ? next : x)))
              }
              onRemove={() =>
                setAssertions((prev) => prev.filter((_, idx) => idx !== i))
              }
            />
          ))}
          <button
            type="button"
            onClick={() =>
              setAssertions((prev) => [
                ...prev,
                { kind: "status_code", op: "eq", value: "200" },
              ])
            }
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-3.5 h-3.5" /> Add assertion
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-[color:var(--status-down)]/40 bg-[color:var(--status-down)]/10 text-[color:var(--status-down)] px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Link
          href="/app/monitors"
          className="inline-flex items-center h-9 px-4 rounded-md border border-input text-sm font-medium"
        >
          Cancel
        </Link>
        <button
          onClick={submit}
          disabled={submitting}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] disabled:opacity-60 text-white text-sm font-semibold"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Create monitor
        </button>
      </div>
    </div>
  )
}
