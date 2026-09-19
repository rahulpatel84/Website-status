# status.watch

A full-stack website & service monitoring platform. Public outage tracker + multi-tenant SaaS dashboard with HTTP/TCP/SSL/browser probes, incident tracking, on-call schedules, branded status pages, notifications (email, Telegram, Slack), a blog CMS, and an installable agent SDK.

Built with Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, Clerk (auth), Supabase (Postgres) or SQLite for local dev, Resend (email), and Playwright (browser probes).

> **Zero-config first run:** clone, `npm install`, `npm run dev`, open <http://localhost:3000>. No API keys required — dev-mode cookie auth + SQLite give you the full app immediately. Real services (Clerk, Supabase, Resend, Telegram) turn on one at a time as you add keys.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Request lifecycle](#request-lifecycle)
- [Monitor probe lifecycle](#monitor-probe-lifecycle)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Further reading](#further-reading)

---

## Features

**Public site**
- Outage tracker for popular services with heatmap, real-time chart, and community reports
- Marketing pages: landing, pricing, about, how-it-works, services, blog, FAQ, contact, legal
- Branded public status pages (`/status/[slug]`)

**Authenticated dashboard (`/app/*`)**
- Monitors: HTTP, TCP, SSL, form/browser, content-hash — with diagnostic waterfall (DNS → TCP → TLS → HTTP)
- Incidents log with open/resolve state, root-cause diffing, and per-monitor timeline
- Status page builder — group components, publish under a custom slug
- On-call schedules with rotation layers
- Notifications: email (Resend), Telegram bot, Slack webhooks — per-channel test-fire
- Logs viewer with filters, per-request detail sheet, and export
- Blog CMS (markdown), API keys, workspace settings, audit trail
- AI assistant panel (OpenRouter) with tool-calling over the monitor/incident data

**Infrastructure**
- Cron-driven probe runner (`/api/cron/probe`) — runs every due monitor per tick
- Public-service catalog worker (`/api/cron/public-services`) — 5-min availability rollups
- Screenshot cleanup, notification cadence, and heartbeat endpoints
- Installable agent SDK: `packages/agent` (`@statuswatch/agent`)
- Fly.io worker (`worker/`) and workflow manager (`manager-workers/`) for out-of-process browser probing

---

## Architecture

```mermaid
graph TB
  subgraph Client["Browser / Agents"]
    Visitor[Visitor]
    Operator[Operator]
    Agent[SDK / heartbeat clients]
  end

  subgraph Edge["Next.js on Vercel"]
    MW[middleware.ts<br/>Clerk / dev-cookie auth]
    Public["(public) routes<br/>marketing, tracker, status pages"]
    App["(app) routes<br/>authed dashboard"]
    API["API routes<br/>/api/*"]
  end

  subgraph Core["Core services (lib/*)"]
    Auth["lib/auth.ts<br/>currentUser + workspace"]
    DB["lib/db-adapter.ts<br/>SQLite ⇄ Supabase"]
    Engine["lib/monitor-engine<br/>runner + waterfall + security"]
    Notif["lib/notifications<br/>email / telegram / slack"]
    Blog[lib/blog.ts]
    AI["lib/ai<br/>OpenRouter + tools"]
  end

  subgraph Data["Data plane"]
    SQLite[(SQLite<br/>data/outages.db)]
    Postgres[(Supabase Postgres)]
    Blob["Vercel Blob<br/>probe screenshots"]
  end

  subgraph Cron["Cron & workers"]
    ProbeCron["/api/cron/probe<br/>every 30–60s"]
    PSCron["/api/cron/public-services<br/>every minute"]
    Fly["worker/ on Fly.io<br/>Playwright browser probes"]
    Manager["manager-workers/<br/>workflow queue"]
  end

  subgraph External["External services"]
    Clerk[Clerk]
    Resend[Resend]
    Telegram[Telegram Bot API]
    Slack[Slack webhooks]
    OpenRouter[OpenRouter]
    Targets[Monitored URLs]
  end

  Visitor --> Public
  Operator --> MW --> App
  Agent --> API
  App --> API
  Public --> API
  API --> Auth
  API --> DB
  API --> Engine
  API --> Notif
  API --> Blog
  API --> AI
  DB --> SQLite
  DB --> Postgres
  Engine --> Targets
  Engine --> Fly
  Engine --> Blob
  Notif --> Resend
  Notif --> Telegram
  Notif --> Slack
  Auth --> Clerk
  AI --> OpenRouter
  ProbeCron --> Engine
  PSCron --> DB
  Manager --> Fly
```

**Design notes**

- **Route groups.** `app/(public)/*` is the marketing + outage-tracker surface, `app/(auth)/*` hosts sign-in/up, and `app/(app)/app/*` is the authenticated SaaS. `middleware.ts` gates `/app/*` — Clerk when both `CLERK_*` keys are present, otherwise a dev cookie (`sw_dev_uid`) so the app is usable with zero config.
- **Storage adapter.** `lib/db-adapter.ts` picks SQLite (`better-sqlite3`) or Supabase Postgres at request time via `storageMode()` — driven by `DATABASE_MODE` or auto-detected from env. The SQL schema is mirrored in `supabase/migrations/*.sql`.
- **Monitor engine.** `lib/monitor-engine/runner.ts` orchestrates a single probe: `waterfall.ts` measures DNS/TCP/TLS/HTTP timings, `security.ts` grades SSL and diffs content hashes, `browser-probe.ts` drives Playwright for form/DOM assertions. State transitions open/resolve incidents in the same transaction.
- **Notifications.** `lib/notifications/dispatch.ts` is the single fan-out point; per-channel modules (`email.ts`, `telegram.ts`) degrade gracefully — no Resend key ⇒ log-to-stdout; no Telegram token ⇒ pairing UI works but no messages fly.
- **Cron.** All periodic work is HTTP-triggered so it fits Vercel Cron or any external scheduler. Endpoints require `Authorization: Bearer $CRON_SECRET`, or localhost origin when the secret is unset.

---

## Data model

Simplified — full schema in `supabase/migrations/0001_init.sql`.

```mermaid
erDiagram
  USER ||--o{ WORKSPACE_MEMBER : "belongs to"
  WORKSPACE ||--o{ WORKSPACE_MEMBER : "has"
  WORKSPACE ||--o{ MONITOR : "owns"
  WORKSPACE ||--o{ STATUS_PAGE : "publishes"
  WORKSPACE ||--o{ CHANNEL : "configures"
  WORKSPACE ||--o{ SCHEDULE : "runs"
  MONITOR ||--o{ PROBE_RESULT : "produces"
  MONITOR ||--o{ INCIDENT : "generates"
  MONITOR ||--o{ ASSERTION : "asserts"
  STATUS_PAGE ||--o{ STATUS_COMPONENT : "shows"
  STATUS_COMPONENT }o--|| MONITOR : "reflects"
  SCHEDULE ||--o{ SCHEDULE_LAYER : "layered by"
  INCIDENT ||--o{ NOTIFICATION_DELIVERY : "triggers"
  CHANNEL ||--o{ NOTIFICATION_DELIVERY : "receives"

  USER {
    string id PK
    string email
    string name
  }
  WORKSPACE {
    string id PK
    string name
    string plan
  }
  MONITOR {
    string id PK
    string workspace_id FK
    string type "http|tcp|ssl|form|hash"
    string target
    int interval_s
    string current_status "up|down|degraded"
    bool is_paused
  }
  PROBE_RESULT {
    string id PK
    string monitor_id FK
    int response_ms
    int http_status
    string layer_failed "dns|tcp|tls|http|runtime"
    timestamp ran_at
  }
  INCIDENT {
    string id PK
    string monitor_id FK
    timestamp opened_at
    timestamp resolved_at
    string reason
  }
```

---

## Request lifecycle

```mermaid
sequenceDiagram
  participant B as Browser
  participant MW as middleware.ts
  participant R as Route handler
  participant A as lib/auth
  participant DB as lib/db-adapter
  participant Ext as External API

  B->>MW: GET /app/monitors
  alt Clerk enabled
    MW->>MW: verify Clerk session
    MW-->>B: 302 /sign-in if unauth
  else Dev mode
    MW->>MW: check sw_dev_uid cookie
    MW-->>B: 302 /sign-in if missing
  end
  MW->>R: dispatch to Server Component
  R->>A: currentUser()
  A-->>R: {id, email, ...}
  R->>A: ensureUserAndWorkspace(user)
  A->>DB: upsert user + workspace
  DB-->>A: {ws.id}
  R->>DB: query monitors for ws.id
  DB-->>R: rows
  R-->>B: rendered HTML

  Note over B,Ext: API mutations follow the same auth path,<br/>then dispatch async work (probe, notification).
```

---

## Monitor probe lifecycle

```mermaid
sequenceDiagram
  participant Cron as Vercel Cron
  participant API as /api/cron/probe
  participant E as monitor-engine/runner
  participant W as waterfall.ts
  participant Sec as security.ts
  participant DB as db-adapter
  participant N as notifications/dispatch
  participant Target

  Cron->>API: POST (Bearer CRON_SECRET)
  API->>DB: SELECT monitors WHERE due
  loop for each due monitor
    API->>E: runMonitor(id)
    E->>W: runHttpWaterfall(target)
    W->>Target: DNS lookup
    W->>Target: TCP connect
    W->>Target: TLS handshake
    W->>Target: HTTP HEAD
    W-->>E: {response_ms, layer_failed, http_status}
    opt SSL / security monitor
      E->>Sec: probeSslGrade / probeContentHash
    end
    E->>DB: INSERT probe_result
    alt state changed
      E->>DB: OPEN or RESOLVE incident
      E->>N: dispatch(incident, channels)
      N-->>Target: (email/telegram/slack fan-out)
    end
    E-->>API: result
  end
  API-->>Cron: 200 {processed: N}
```

---

## Repository layout

```
app/
  (public)/       marketing + outage tracker + branded status pages
  (auth)/         sign-in / sign-up (Clerk or dev cookie)
  (app)/app/      authed dashboard: monitors, incidents, logs, on-call, ...
  api/            REST + webhook + cron endpoints
  status/[slug]/  public status page
components/
  app-shell/      sidebar, topbar, workspace pill, theme toggle
  auth/           Clerk provider wrapper
  blog/           CMS editor + article renderer
  logs/ monitor/  domain-specific UI
  ui/             shadcn primitives
lib/
  auth.ts         Clerk + dev-cookie shim
  db-adapter.ts   SQLite ⇄ Supabase Postgres
  database.ts     legacy SQLite entry point (being folded into db-adapter)
  monitor-engine/ runner, waterfall, browser-probe, security, advisory
  notifications/  dispatch, email, telegram, format
  ai/             OpenRouter client + tool definitions
  blog.ts, logger.ts, rate-limit.ts, ip-hash.ts, ...
packages/agent/   installable SDK (@statuswatch/agent)
manager-workers/  workflow queue for out-of-process work
worker/           Fly.io Playwright worker (Dockerfile + fly.toml)
supabase/migrations/  SQL schema mirrors of lib/database.ts
scripts/          probe-tick.js, public-service-tick.js, telegram-poll.mjs
research/         product & competitive research notes
wireframes/       original HTML mocks
```

---

## Getting started

```bash
git clone https://github.com/rahulpatel84/Website-status.git
cd Website-status
npm install
cp .env.example .env.local     # optional — leave keys blank to run in dev mode
npm run dev
```

Open <http://localhost:3000>:

- `/` — public outage tracker
- `/landing` — SaaS marketing page
- `/pricing` — plans
- `/sign-up` — creates a dev-mode user (no email verification)
- `/app` — authenticated dashboard

Wipe local state at any time with `rm data/outages.db*`.

### Optional: browser probes

Playwright ships as a dep but needs its browsers:

```bash
npx playwright install --with-deps chromium
```

### Optional: Telegram poller for local dev

Telegram can't reach `localhost`. In a second terminal:

```bash
npm run telegram:poll
```

---

## Environment variables

Everything is optional for local dev. Set what you need in `.env.local`.

| Group | Variable | Purpose |
| --- | --- | --- |
| Auth | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Enables real Clerk auth (falls back to dev cookie) |
| Database | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Postgres storage (falls back to SQLite) |
| Database | `DATABASE_MODE` | Force `sqlite` or `supabase` |
| Email | `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Outbound alert emails (falls back to console log) |
| Telegram | `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` / `TELEGRAM_WEBHOOK_SECRET` | Bot alerts + pairing |
| Cron | `CRON_SECRET` | Bearer token for `/api/cron/*` (localhost-only when unset) |
| AI | `OPENROUTER_API_KEY` | Assistant chat + tools |
| App | `NEXT_PUBLIC_APP_URL` | Absolute URLs (heartbeats, status page links, webhook signatures) |
| Screenshots | `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage for probe screenshots |

See [SETUP.md](./SETUP.md) for a step-by-step walkthrough of turning each service on.

---

## Deployment

**Vercel** is the default target — one click, works with Clerk / Supabase / Resend / Blob env vars set in the project dashboard.

1. Import the repo on Vercel.
2. Add env vars (see table above).
3. Apply `supabase/migrations/*.sql` in the Supabase SQL editor (or `supabase db push`).
4. Register cron jobs (either Vercel Cron via `vercel.json`, or an external scheduler hitting `/api/cron/probe` with `Authorization: Bearer $CRON_SECRET`).
5. Point Telegram's webhook at `https://your-domain.com/api/telegram/webhook`.

The `worker/` directory ships a `Dockerfile` + `fly.toml` for the out-of-process Playwright worker on Fly.io — useful when Vercel's function limits are too tight for browser probes.

Full playbook in [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Further reading

- [`SETUP.md`](./SETUP.md) — turning on Clerk, Supabase, Resend, Telegram, cron, and the SDK, one service at a time
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Vercel + Fly deployment, migrations, secrets
- [`AGENT_CONVENTIONS.md`](./AGENT_CONVENTIONS.md) — coding conventions for contributors
- [`research/`](./research/) — competitive analysis, roadmap, and design notes
- [`wireframes/`](./wireframes/) — original HTML mocks

---

## License

Not yet declared — treat this repo as source-available for now. Add a `LICENSE` file before public distribution.
