import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Setup guide — status.watch",
  description:
    "How the backend + database work, and the exact steps to get status.watch running in production.",
}

export default function SetupPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:px-6 py-10">
      <Header />
      <Section1_HowItWorks />
      <Section2_Database />
      <Section3_RequestLife />
      <Section4_WhatYouDo />
      <Footer />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function Header() {
  return (
    <div className="mb-12">
      <div className="text-xs font-mono tracking-wider text-muted-foreground uppercase mb-2">
        Setup guide
      </div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
        How this project works, end to end
      </h1>
      <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
        A tour of the pieces you're deploying: the Next.js app, the SQLite → Postgres database,
        the cron/probe engine, and exactly what steps you still need to do yourself.
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <a href="#how" className="rounded-full border border-border bg-card px-3 py-1 hover:bg-muted">
          1 · How it works
        </a>
        <a href="#db" className="rounded-full border border-border bg-card px-3 py-1 hover:bg-muted">
          2 · Database
        </a>
        <a href="#req" className="rounded-full border border-border bg-card px-3 py-1 hover:bg-muted">
          3 · Request life
        </a>
        <a href="#todo" className="rounded-full border border-border bg-card px-3 py-1 hover:bg-muted">
          4 · What you do
        </a>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 1. Architecture                                                     */
/* ------------------------------------------------------------------ */

function Section1_HowItWorks() {
  const layers: {
    tier: string
    stack: string
    role: string
    where: string
  }[] = [
    {
      tier: "Client",
      stack: "React server + client components",
      role: "Renders every UI page. Client components hit the API routes below.",
      where: "app/(public)/*, app/(app)/*",
    },
    {
      tier: "API routes",
      stack: "Next.js route handlers (Node runtime)",
      role: "Every /api/* URL is a Node function: auth check → DB call → JSON response.",
      where: "app/api/*",
    },
    {
      tier: "Business logic",
      stack: "Pure TS libraries",
      role: "Reusable modules: monitor runner, notification dispatch, alert formatter, auth.",
      where: "lib/monitor-engine/*, lib/notifications/*, lib/auth.ts",
    },
    {
      tier: "Database",
      stack: "SQLite (local) → Supabase Postgres (prod)",
      role: "34 tables holding monitors, probes, incidents, users, comments, on-call, logs.",
      where: "data/outages.db (dev), Supabase project (prod)",
    },
    {
      tier: "Cron / Worker",
      stack: "Vercel Cron (1 min) + Fly.io worker (30 s)",
      role: "Ticks /api/cron/probe and /api/cron/public-services so monitors run automatically.",
      where: "vercel.json + worker/Dockerfile",
    },
    {
      tier: "External services",
      stack: "Clerk · Resend · Telegram · OpenRouter",
      role: "Auth, email, chat alerts, AI assistant. Each optional — app falls back when a key is missing.",
      where: ".env.local",
    },
  ]

  return (
    <section id="how" className="mb-14 scroll-mt-8">
      <SectionHeader
        emoji="🏗️"
        title="1. How the app works"
        subtitle="Six moving parts. Each layer only talks to the one directly below it."
      />

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {layers.map((l, i) => (
          <div
            key={l.tier}
            className={
              "grid grid-cols-1 md:grid-cols-[130px_1fr_260px] gap-4 px-5 py-4 " +
              (i < layers.length - 1 ? "border-b border-border" : "")
            }
          >
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-mono text-muted-foreground shrink-0">
                {i + 1}
              </span>
              <span className="font-semibold text-foreground">{l.tier}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm text-foreground font-medium">{l.stack}</div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {l.role}
              </p>
            </div>
            <div className="text-xs font-mono text-muted-foreground truncate">
              {l.where}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-4 max-w-3xl leading-relaxed">
        In dev everything runs on your laptop. In prod, layers 1–3 live on{" "}
        <b className="text-foreground">Vercel</b>, layer 4 lives on{" "}
        <b className="text-foreground">Supabase</b>, and the cron worker lives on{" "}
        <b className="text-foreground">Fly.io</b>.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 2. Database                                                         */
/* ------------------------------------------------------------------ */

function Section2_Database() {
  const groups: {
    name: string
    color: string
    tables: string[]
    purpose: string
  }[] = [
    {
      name: "Auth",
      color: "bg-blue-50 border-blue-200 text-blue-800",
      tables: ["app_users", "workspaces", "workspace_members", "api_keys"],
      purpose: "Who you are and what workspace you belong to. Filled by Clerk on first sign-in.",
    },
    {
      name: "Monitoring",
      color: "bg-emerald-50 border-emerald-200 text-emerald-800",
      tables: ["monitors", "assertions", "probes", "probe_screenshots", "heartbeat_checkins"],
      purpose: "The core of the app. Each probe result appends one row; monitors are what you configure.",
    },
    {
      name: "Incidents",
      color: "bg-red-50 border-red-200 text-red-800",
      tables: ["incidents", "incident_events", "incident_updates", "incident_roles", "incident_followups"],
      purpose: "Auto-opened when a monitor goes down, resolved when it recovers. Timeline + collab lives here.",
    },
    {
      name: "Notifications",
      color: "bg-purple-50 border-purple-200 text-purple-800",
      tables: [
        "notification_channels",
        "monitor_channels",
        "incident_channel_notifications",
        "telegram_pairings",
      ],
      purpose: "Where alerts get sent (email / telegram / slack / webhook) and per-channel renotify timing.",
    },
    {
      name: "On-call",
      color: "bg-amber-50 border-amber-200 text-amber-800",
      tables: ["on_call_schedules", "on_call_layers", "on_call_overrides", "escalation_policies"],
      purpose: "Rotation schedules and escalation chains for who gets paged when.",
    },
    {
      name: "Status pages",
      color: "bg-cyan-50 border-cyan-200 text-cyan-800",
      tables: ["status_pages", "status_page_components"],
      purpose: "Publicly hosted status pages you assemble from your monitors.",
    },
    {
      name: "Public tracker",
      color: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-800",
      tables: [
        "outage_reports",
        "outage_stats",
        "comments",
        "comment_votes",
        "comment_flags",
        "public_service_status",
        "public_service_status_buckets",
        "public_service_incidents",
      ],
      purpose: "The /services side of the app — user-reported outages + auto-checks of the 100-site catalog.",
    },
    {
      name: "Logs",
      color: "bg-slate-50 border-slate-200 text-slate-800",
      tables: ["event_logs", "activity_logs"],
      purpose: "Everything the app does gets stamped here. Powers /app/logs.",
    },
  ]

  const totalTables = groups.reduce((n, g) => n + g.tables.length, 0)

  return (
    <section id="db" className="mb-14 scroll-mt-8">
      <SectionHeader
        emoji="🗄️"
        title="2. How the database works"
        subtitle={`All ${totalTables} tables in one picture, grouped by what they do.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((g) => (
          <div key={g.name} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h3 className="font-semibold text-foreground">{g.name}</h3>
              <span
                className={
                  "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border " +
                  g.color
                }
              >
                {g.tables.length} table{g.tables.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">{g.purpose}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.tables.map((t) => (
                <code
                  key={t}
                  className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-foreground border border-border"
                >
                  {t}
                </code>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 mt-4">
        <h3 className="font-semibold text-foreground mb-2">Where the tables live</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Local dev
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Everything sits in one file:{" "}
              <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
                data/outages.db
              </code>
              . Created/upgraded automatically the first time the app boots. Zero setup.
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Production (Supabase)
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Same schema, in Postgres. Migrations:{" "}
              <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
                {"supabase/migrations/000{1,2,3}_*.sql"}
              </code>
              . Apply once via{" "}
              <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">supabase db push</code>.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 3. Request lifecycle                                                */
/* ------------------------------------------------------------------ */

function Section3_RequestLife() {
  const steps: {
    step: number
    title: string
    detail: string
    where: string
  }[] = [
    {
      step: 1,
      title: "Cron fires",
      detail:
        "Every minute (Vercel) or 30s (Fly worker), a request hits /api/cron/probe with a bearer token.",
      where: "vercel.json + worker/entrypoint.sh",
    },
    {
      step: 2,
      title: "Route picks the due monitors",
      detail:
        "Handler asks the DB: 'which monitors haven't been checked in ≥ their interval?' — batches up to 100.",
      where: "app/api/cron/probe/route.ts",
    },
    {
      step: 3,
      title: "Runner probes each one",
      detail:
        "runMonitor(id) runs the layer waterfall — DNS → TCP → TLS → HTTP → body assertion. Returns up/down + which layer failed.",
      where: "lib/monitor-engine/runner.ts",
    },
    {
      step: 4,
      title: "Write results",
      detail:
        "One row appended to probes; monitors.current_status updated. If status flipped to down, insert an incidents row.",
      where: "→ probes, monitors, incidents",
    },
    {
      step: 5,
      title: "Fan out alerts",
      detail:
        "For each notification_channel attached to the monitor: format the message, POST to Telegram / Resend / Slack. Stamp incident_channel_notifications so we know when to renotify.",
      where: "lib/notifications/dispatch.ts",
    },
    {
      step: 6,
      title: "UI reads fresh state",
      detail:
        "Next.js server components query the DB on every page load. No refresh loops needed — the data on /app/monitors is always the latest write.",
      where: "app/(app)/app/monitors/page.tsx",
    },
  ]

  return (
    <section id="req" className="mb-14 scroll-mt-8">
      <SectionHeader
        emoji="🔄"
        title="3. What happens when a monitor runs"
        subtitle="From cron tick to Telegram ping, in six hops."
      />

      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.step} className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-[color:var(--brand-500)] text-white text-sm font-bold grid place-items-center shrink-0">
              {s.step}
            </div>
            <div className="flex-1 rounded-xl border border-border bg-card p-4 min-w-0">
              <div className="flex items-baseline gap-3 flex-wrap mb-1">
                <h3 className="font-semibold text-foreground">{s.title}</h3>
                <code className="text-[11px] font-mono text-muted-foreground">
                  {s.where}
                </code>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 4. What you need to do                                              */
/* ------------------------------------------------------------------ */

function Section4_WhatYouDo() {
  const tracks: {
    id: string
    title: string
    scope: string
    time: string
    color: string
    steps: { label: string; cmd?: string; note?: string }[]
  }[] = [
    {
      id: "quick",
      title: "Track A · Ship the marketing surface only",
      scope: "Landing + /pricing + /services + /plan + /setup live on your domain. App routes stay local.",
      time: "~30 min",
      color: "text-emerald-700 border-emerald-200 bg-emerald-50",
      steps: [
        {
          label: "Commit everything",
          cmd: "git add . && git commit -m 'Initial deploy'",
        },
        {
          label: "Push to GitHub",
          cmd: "git remote add origin <your-repo> && git push -u origin main",
          note: "Create an empty repo on github.com first.",
        },
        {
          label: "Create Vercel project",
          cmd: "npx vercel",
          note: "It auto-detects Next.js. Say yes to the defaults.",
        },
        {
          label: "Add env vars",
          note: "Vercel → Project → Settings → Environment Variables. Copy each key from .env.local. Bare minimum for marketing: NEXT_PUBLIC_APP_URL.",
        },
        {
          label: "Ship prod",
          cmd: "npx vercel --prod",
        },
      ],
    },
    {
      id: "full",
      title: "Track B · Full app in production",
      scope: "Everything works — monitors, alerts, on-call, status pages. Requires the DB port.",
      time: "1–3 days",
      color: "text-purple-700 border-purple-200 bg-purple-50",
      steps: [
        {
          label: "Create Supabase project",
          note: "supabase.com → New project. Grab URL + anon key + service_role key from Settings → API.",
        },
        {
          label: "Push schema",
          cmd: "supabase link --project-ref <ref> && supabase db push",
          note: "Or paste each supabase/migrations/*.sql into the SQL editor manually.",
        },
        {
          label: "Port DB calls (biggest job)",
          note: "57 files call getDatabase() (SQLite). Each needs a Postgres path via lib/db-adapter.ts. Grind through them table-by-table — start with monitors, probes, incidents.",
        },
        {
          label: "Do the marketing deploy (Track A)",
          note: "Same steps as A: commit, push, vercel.",
        },
        {
          label: "Add all env vars on Vercel",
          note: "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_CLERK_*, CLERK_SECRET_KEY, RESEND_API_KEY, TELEGRAM_BOT_TOKEN, CRON_SECRET.",
        },
        {
          label: "Enable Vercel Blob",
          cmd: "npm i @vercel/blob",
          note: "Vercel Dashboard → Storage → Create Blob. Auto-injects BLOB_READ_WRITE_TOKEN.",
        },
        {
          label: "Deploy the Fly worker",
          cmd: "fly launch --dockerfile worker/Dockerfile\nfly secrets set APP_URL=… CRON_SECRET=…\nfly deploy",
          note: "Gives you 30s cadence. Skip if 1min from Vercel Cron is fine.",
        },
      ],
    },
  ]

  return (
    <section id="todo" className="mb-14 scroll-mt-8">
      <SectionHeader
        emoji="✅"
        title="4. What you actually need to do"
        subtitle="Pick the track that matches how far you want to go today."
      />

      <div className="space-y-4">
        {tracks.map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-baseline gap-3 flex-wrap mb-1">
                <h3 className="font-bold text-foreground">{t.title}</h3>
                <span
                  className={"text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border " + t.color}
                >
                  {t.time}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{t.scope}</p>
            </div>
            <ol className="divide-y divide-border">
              {t.steps.map((s, i) => (
                <li key={i} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-muted text-foreground text-xs font-bold grid place-items-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm">{s.label}</div>
                      {s.cmd && (
                        <pre className="mt-2 text-[11px] font-mono bg-muted rounded-md p-2 overflow-x-auto text-foreground border border-border">
                          {s.cmd}
                        </pre>
                      )}
                      {s.note && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {s.note}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-bold mb-3">Related pages in this project</h2>
      <ul className="space-y-2 text-sm">
        <li>
          <a href="/plan" className="text-[color:var(--brand-700)] hover:underline font-medium">
            /plan
          </a>{" "}
          <span className="text-muted-foreground">
            — live status board of what's done vs. what's pending per phase
          </span>
        </li>
        <li>
          <a href="/services" className="text-[color:var(--brand-700)] hover:underline font-medium">
            /services
          </a>{" "}
          <span className="text-muted-foreground">— the 100-site public monitor catalog</span>
        </li>
        <li>
          <a href="/pricing" className="text-[color:var(--brand-700)] hover:underline font-medium">
            /pricing
          </a>{" "}
          <span className="text-muted-foreground">— the tier structure users see</span>
        </li>
        <li>
          <span className="font-mono text-muted-foreground">DEPLOYMENT.md</span>{" "}
          <span className="text-muted-foreground">— full command list at the repo root</span>
        </li>
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Reusable header                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({
  emoji,
  title,
  subtitle,
}: {
  emoji: string
  title: string
  subtitle: string
}) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-2xl">{emoji}</span>
        <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground max-w-3xl">{subtitle}</p>
    </div>
  )
}
