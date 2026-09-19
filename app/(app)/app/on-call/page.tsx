import Link from "next/link"
import { Plus, CalendarClock } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { CreateScheduleButton } from "./create-schedule-button"

interface ScheduleRow {
  id: string
  name: string
  timezone: string
  layer_count: number
}

interface EscalationRow {
  id: string
  name: string
  steps: string
  repeat_count: number
}

export default async function OnCallPage() {
  const { workspace } = await requireAuth()
  const db = getDatabase()
  const schedules = db
    .prepare(
      `SELECT s.id, s.name, s.timezone,
              (SELECT COUNT(*) FROM on_call_layers WHERE schedule_id = s.id) AS layer_count
       FROM on_call_schedules s
       WHERE s.workspace_id = ?
       ORDER BY s.created_at DESC`,
    )
    .all(workspace.id) as ScheduleRow[]

  const policies = db
    .prepare(
      "SELECT id, name, steps, repeat_count FROM escalation_policies WHERE workspace_id = ? ORDER BY created_at DESC",
    )
    .all(workspace.id) as EscalationRow[]

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">On-call</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rotations, overrides, and escalation policies for who gets paged.
          </p>
        </div>
        <CreateScheduleButton />
      </div>

      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Schedules</h2>
          <div className="text-xs text-muted-foreground">
            {schedules.length} {schedules.length === 1 ? "schedule" : "schedules"}
          </div>
        </div>

        {schedules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <CalendarClock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No on-call schedules yet. Create one to define rotations for who gets alerted.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-b-0"
              >
                <div className="w-10 h-10 rounded-md bg-[color:var(--brand-50)] text-[color:var(--brand-700)] grid place-items-center">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.timezone} · {s.layer_count} layer{s.layer_count === 1 ? "" : "s"}
                  </div>
                </div>
                <Link
                  href={`/app/on-call/${s.id}`}
                  className="inline-flex items-center h-8 px-3 rounded-md border border-input text-xs font-semibold"
                >
                  Edit
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Escalation policies</h2>
          <button
            disabled
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input text-xs font-medium text-muted-foreground opacity-60 cursor-not-allowed"
            title="Coming next: multi-step escalation with time-outs, SMS + voice"
          >
            <Plus className="w-3.5 h-3.5" /> New policy (soon)
          </button>
        </div>

        {policies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-xs text-muted-foreground">
              Escalation policies chain your schedules together with per-step time-outs and channel
              routing (SMS, voice, push). Coming in the next wave — the schedule you build now will
              plug straight in.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {policies.map((p) => (
              <div key={p.id} className="px-5 py-4 border-b border-border last:border-b-0">
                <div className="font-semibold text-sm">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.repeat_count > 0 ? `repeats ${p.repeat_count}×` : "no repeat"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
