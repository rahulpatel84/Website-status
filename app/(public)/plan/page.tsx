import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Deployment plan — status.watch",
  description: "Vercel + Supabase + Fly.io deployment plan and current status.",
}

interface Step {
  id: string
  title: string
  status: "done" | "wired" | "pending" | "manual"
  detail: string
  needs?: string[]
}

const PLAN: {
  phase: string
  emoji: string
  intro: string
  steps: Step[]
}[] = [
  {
    phase: "Phase 1 — Database",
    emoji: "🗄️",
    intro:
      "Move all state off SQLite (which doesn't persist on Vercel) into Supabase Postgres. Schema already lives in supabase/migrations/*.sql — the app talks to it through a runtime-switched adapter.",
    steps: [
      {
        id: "1a",
        title: "Postgres schema (0001 + 0002 + 0003)",
        status: "done",
        detail:
          "All 34 tables and indexes ported. Latest migration 0003_notification_cadence.sql covers last_notified_at + incident_channel_notifications from the recent renotify work.",
      },
      {
        id: "1b",
        title: "Runtime adapter (lib/db-adapter.ts)",
        status: "wired",
        detail:
          "Env-detects sqlite vs supabase. usePostgres() flips based on NODE_ENV + SUPABASE_SERVICE_ROLE_KEY. Force with DATABASE_MODE.",
        needs: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      },
      {
        id: "1c",
        title: "Per-route porting (55 files call getDatabase())",
        status: "pending",
        detail:
          "public-service-history.ts already dual-writes to both stores. Remaining 54 files (monitors, incidents, api-keys, comments, on-call, activity-logs, etc.) still call better-sqlite3 directly. Incremental port — hottest paths first.",
      },
      {
        id: "1d",
        title: "Data copy: SQLite → Supabase",
        status: "manual",
        detail:
          "One-shot dump/restore before cutover. sqlite3 data/outages.db .dump | pg-friendly rewrite → psql. Non-trivial for datetimes; see DEPLOYMENT.md § 'One-shot data copy'.",
      },
    ],
  },
  {
    phase: "Phase 2 — Hosting (Vercel)",
    emoji: "▲",
    intro:
      "Next.js app on Vercel. UI, API routes, auth, incident dispatch — everything the user hits. Vercel Cron keeps a 1-min safety-net for probes and the daily cleanup.",
    steps: [
      {
        id: "2a",
        title: "vercel.json crons + function limits",
        status: "done",
        detail:
          "Kept the three existing cron paths as safety-nets; added maxDuration=60 for probe + public-services routes so full 100-site fanout can finish.",
      },
      {
        id: "2b",
        title: "Vercel Blob for probe screenshots",
        status: "wired",
        detail:
          "lib/blob-storage.ts detects BLOB_READ_WRITE_TOKEN → uses @vercel/blob. Falls back to local disk when token unset. Two callers to update: browser-probe write + screenshot-cleanup delete.",
        needs: ["BLOB_READ_WRITE_TOKEN", "npm i @vercel/blob"],
      },
      {
        id: "2c",
        title: "Clerk + all existing env",
        status: "done",
        detail:
          "Nothing changes — Clerk keys work identically in production. Copy .env.local values into Vercel project settings.",
      },
    ],
  },
  {
    phase: "Phase 3 — Worker (Fly.io)",
    emoji: "🎈",
    intro:
      "Long-lived container that pokes the Vercel-hosted cron endpoints every 30 seconds. Needed because Vercel Cron's floor is 1 minute — this gets you true 30s monitoring.",
    steps: [
      {
        id: "3a",
        title: "worker/Dockerfile + entrypoint.sh",
        status: "done",
        detail:
          "Node 20 alpine image. Runs probe-tick.js + public-service-tick.js concurrently. Tiny http server on $PORT for Fly health checks. If any child dies, container restarts.",
      },
      {
        id: "3b",
        title: "worker/fly.toml",
        status: "done",
        detail:
          "shared-cpu-1x / 256mb. min_machines_running = 1 so it never scales to zero. Set primary_region close to your Vercel deployment.",
      },
      {
        id: "3c",
        title: "fly deploy + secrets",
        status: "manual",
        detail:
          "fly launch --dockerfile worker/Dockerfile then fly secrets set APP_URL=… CRON_SECRET=…. See DEPLOYMENT.md § 'Deploy the worker'.",
        needs: ["fly CLI login", "APP_URL (Vercel domain)", "CRON_SECRET"],
      },
    ],
  },
]

const STATUS_META: Record<Step["status"], { label: string; color: string; bg: string }> = {
  done: { label: "Done", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  wired: { label: "Wired", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  manual: { label: "Manual", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
}

export default function PlanPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:px-6 py-10">
      <div className="mb-10">
        <div className="text-xs font-mono tracking-wider text-muted-foreground uppercase mb-2">
          Deployment plan
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Vercel + Supabase + Fly.io
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
          Three-tier deploy: Next.js on <b className="text-foreground">Vercel</b>, Postgres +
          storage on <b className="text-foreground">Supabase</b>, sub-minute cron ticker on{" "}
          <b className="text-foreground">Fly.io</b>. Everything's scaffolded — the boxes below
          show what's coded up vs. what needs API keys or manual steps from you.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-10">
        {(Object.keys(STATUS_META) as Step["status"][]).map((s) => {
          const count = PLAN.flatMap((p) => p.steps).filter((st) => st.status === s).length
          const meta = STATUS_META[s]
          return (
            <div
              key={s}
              className={`rounded-lg border p-3 ${meta.bg}`}
            >
              <div className={`text-xs font-semibold ${meta.color}`}>{meta.label}</div>
              <div className="text-2xl font-bold text-foreground mt-1">{count}</div>
            </div>
          )
        })}
      </div>

      <div className="space-y-10">
        {PLAN.map((phase) => (
          <section key={phase.phase}>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-2xl">{phase.emoji}</span>
              <h2 className="text-xl font-bold tracking-tight">{phase.phase}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5 max-w-3xl leading-relaxed">
              {phase.intro}
            </p>

            <ol className="space-y-3">
              {phase.steps.map((step) => {
                const meta = STATUS_META[step.status]
                return (
                  <li
                    key={step.id}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex items-start gap-3 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5">
                        {step.id}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-3 flex-wrap">
                          <h3 className="font-semibold text-foreground">{step.title}</h3>
                          <span
                            className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${meta.bg} ${meta.color} border`}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                          {step.detail}
                        </p>
                        {step.needs && step.needs.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Needs:
                            </span>
                            {step.needs.map((n) => (
                              <code
                                key={n}
                                className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-foreground border border-border"
                              >
                                {n}
                              </code>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        ))}
      </div>

      <section className="mt-12 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold mb-4">What you provide, in order</h2>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)] text-xs font-bold grid place-items-center shrink-0">
              1
            </span>
            <div>
              <b>Supabase project.</b> Create at supabase.com. Grab the URL, anon key, and{" "}
              <b>service role key</b> from Settings → API. Run{" "}
              <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
                supabase db push
              </code>{" "}
              (or paste each migration SQL manually) to apply the schema.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)] text-xs font-bold grid place-items-center shrink-0">
              2
            </span>
            <div>
              <b>Vercel project.</b>{" "}
              <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">vercel</code> from
              repo root. Add every env var from <code>.env.local</code> to Project → Settings →
              Environment Variables. Enable Vercel Blob (creates{" "}
              <code>BLOB_READ_WRITE_TOKEN</code> for you), then{" "}
              <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
                vercel --prod
              </code>
              .
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)] text-xs font-bold grid place-items-center shrink-0">
              3
            </span>
            <div>
              <b>Fly.io app.</b>{" "}
              <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
                fly launch --dockerfile worker/Dockerfile
              </code>{" "}
              from repo root, accept the defaults. Then{" "}
              <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
                fly secrets set APP_URL=https://your-app.vercel.app CRON_SECRET=…
              </code>{" "}
              and{" "}
              <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
                fly deploy
              </code>
              . Container starts pinging your Vercel cron endpoints every 30s.
            </div>
          </li>
        </ol>
        <p className="text-xs text-muted-foreground mt-5">
          Full step-by-step commands, including the SQLite → Postgres data copy, live in{" "}
          <code className="font-mono">DEPLOYMENT.md</code> at the repo root.
        </p>
      </section>
    </div>
  )
}
