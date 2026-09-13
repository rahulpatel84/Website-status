# Phase 2 — SaaS Platform Build Plan

Consolidates the SaaS-journey wireframes, SDK research, and target stack into an actionable build plan.

---

## 1. Product summary

status.watch evolves from a Downdetector-style public tracker into a full uptime SaaS. Users sign up, add custom monitors (URL, form, API, port, SSL, cron heartbeat), get alerts via email + Telegram + Slack + webhook, publish branded status pages, and optionally install an SDK that self-diagnoses which layer of their stack failed.

## 2. Target stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 14 App Router** (already in place) | No change |
| Database | **Supabase Postgres** (replaces SQLite) | Multi-tenant, RLS, generous free tier, connection pooling built-in |
| Auth | **Clerk** with Google OAuth + Email/password | Fastest path to SSO, org-level auth, prebuilt UI |
| Email | **Resend** | Transactional deliverability, React email templates |
| Telegram | **`@statuswatch_bot`** via Telegraf on our own function | Deep-links + pairing codes |
| Cron / uptime probes | **Vercel Cron + Vercel Functions** (or Fly Machines for headless-browser form checks) | Keep infra minimal at first |
| SDK | **`@statuswatch/agent`** — Node first, then Python + curl | Node covers most of our target market |
| Payments | **Stripe** (Pro & Team plans) | Standard |

## 3. Data model (Supabase)

Tables (all row-level secured by `workspace_id`):

- `users` (Clerk-linked, synced via webhook)
- `workspaces` (user's org; every user gets one on signup)
- `workspace_members(workspace_id, user_id, role)` — owner / admin / member / viewer
- `monitors(id, workspace_id, name, type, target, interval_s, regions[], config jsonb, is_paused, created_at)` — `type` in `(url, form, api, port, ssl, dns, heartbeat)`
- `assertions(id, monitor_id, kind, op, value)` — kind: `status_code | body | header | response_ms`
- `probes(id, monitor_id, region, status, response_ms, layer_failed, http_status, ran_at)` — one row per check per region
- `incidents(id, monitor_id, started_at, resolved_at, severity, root_cause, layer_isolated)`
- `notification_channels(id, workspace_id, kind, config jsonb, is_verified)` — email, telegram, slack, webhook
- `monitor_channels(monitor_id, channel_id)` — many-to-many
- `status_pages(id, workspace_id, slug, name, brand jsonb, visibility, custom_domain)`
- `status_page_components(id, page_id, group_name, monitor_id, order)`
- `api_keys(id, workspace_id, hashed_token, prefix, last_used_at, created_at)`
- `heartbeats(id, monitor_id, token, expected_interval_s, grace_s, last_seen_at)`
- `sdk_events(id, workspace_id, project, kind, payload jsonb, received_at)` — event log from installed agents

Keep public-tracker tables (`outage_reports`, `outage_stats`, `comments`, etc.) — they migrate to Supabase alongside the SaaS tables. Public tracker becomes `workspace_id = NULL` rows.

## 4. Screens ↔ routes

| Wireframe | Next.js route | Notes |
| --- | --- | --- |
| landing.html | `/` (replace current homepage OR move current to `/track`) | Decision needed — see §7 |
| pricing.html | `/pricing` | Static |
| auth.html | Clerk `<SignIn />` / `<SignUp />` embeds | Handled by Clerk |
| dashboard.html | `/app` (protected) | Server component reads monitors |
| monitor-new.html | `/app/monitors/new` | 3-step form; server action |
| monitor-detail.html | `/app/monitors/[id]` | Includes response chart + waterfall |
| notifications.html | `/app/notifications` | Channel CRUD |
| telegram-connect.html | `/app/notifications/telegram` | Pairing-code flow |
| status-page-config.html | `/app/status-pages/[id]` | Live preview via iframe |
| status-page-public.html | `/status/[slug]` (unprotected) | Rendered from db |
| agent-install.html | `/app/agent` | Copy-paste snippets |
| incidents.html | `/app/incidents` | Filter + export |
| settings.html | `/app/settings` | Profile / workspace / API keys / billing |

## 5. Notification design

- **Email** — Resend + `@react-email/components` templates. From `alerts@statuswatch.io`. Signed SPF/DKIM configured via CNAME.
- **Telegram** — long-poll or webhook. Bot generates 8-char pairing code on `/start`. User pastes it in web UI (`/app/notifications/telegram`) — link stored as `chat_id` in `notification_channels.config`. Alerts are rich cards with Acknowledge / Silence / Open buttons via callback_data.
- **Slack** — OAuth v2 flow, per-workspace incoming webhook, channel selector UI.
- **Webhook** — HMAC-signed payload, exponential-backoff retry (2s, 8s, 30s, 2m, 10m), delivery log per attempt.

## 6. Monitor engine

Two probe classes:
1. **Fast lightweight** (URL, API, port, SSL, DNS, heartbeat check) — runs on **Vercel Cron**, one function per region every 30s/60s.
2. **Heavyweight** (form check with headless browser) — **Fly Machines** or **Cloudflare Browser Rendering**. Deferred; Pro-plan only.

Every probe writes a `probes` row. A tiny SQL trigger opens an `incidents` row when a monitor flips `up → down` for ≥ N consecutive fails, and resolves it on the first successful check. The alert-fanout worker reads new incidents and dispatches per channel.

## 7. Open scope decisions (need your call)

1. **Public tracker + SaaS on same domain?** Recommended: keep `/` for tracker (SEO), promote SaaS at `/app`. Alternative: SaaS at root, tracker at `/track`.
2. **Data migration**: SQLite → Supabase now (before Phase 2 build) OR keep public tracker on SQLite and add Supabase only for SaaS tables? Simpler = keep both, wire SDK/monitors into Supabase only.
3. **SDK repo**: monorepo (new `packages/agent`) vs. separate repo. Monorepo is simpler for shared types.
4. **Regions**: start with 2 (US-East + EU-Central) or ship 1 (US-East) at MVP?
5. **Billing**: launch with Stripe from day one, or ship free-only and add Pro later?

## 8. Required credentials (blockers you must provide)

Before I can start Phase 2 implementation, please create these and share the values (I'll put them in `.env.local`, not commit them):

- **Supabase**: project URL + service-role key + anon key. https://supabase.com/dashboard → New project.
- **Clerk**: publishable key + secret key. https://dashboard.clerk.com → New application. Enable Google OAuth in Clerk's dashboard.
- **Google OAuth**: only needed if you skip Clerk. With Clerk enabled, Clerk handles Google for you.
- **Resend**: API key + verified sending domain (or use their test domain first). https://resend.com
- **Telegram**: bot token from `@BotFather`. Name suggestion: `@statuswatch_bot`.
- **Stripe** (only if launching paid plans on day one): secret key + webhook signing secret.

Optional:
- **Vercel**: for hosting cron probes. If we deploy locally, we can start with a Node worker.
- **Fly.io**: only when we ship the headless-browser form-check monitor type.

## 9. Recommended build order

Phased so we ship value each step:

**Wave A — Foundation (parallelizable, ~1 day)**
1. Migrate schema: add Supabase, port existing SQLite tables into it, add all SaaS tables.
2. Wire Clerk sign-in/sign-up + Google OAuth. Protect `/app/*` routes. Create workspace on first sign-in.
3. New landing (`/`) + pricing pages from wireframes.

**Wave B — Core monitoring (~2 days)**
4. Monitor CRUD (create/list/edit/pause/delete). Support types: URL, API, port, SSL, heartbeat. Form monitor type deferred to Wave D.
5. Probe worker (Vercel cron) — hits every monitor per interval, writes `probes` rows.
6. Diagnostic waterfall (server-side): on failure, run DNS → TCP → TLS → HTTP → assertion probes and store `layer_failed`.
7. Monitor detail page — uptime bar, response chart, diagnostic waterfall panel.

**Wave C — Alerting + status pages (~2 days)**
8. Email channel + Resend integration + verification flow.
9. Telegram bot: pairing code, webhook, callback buttons.
10. Slack OAuth + webhook channel.
11. Webhook channel with signed retry.
12. Incident engine + fanout worker.
13. Status page builder + public renderer at `/status/[slug]`.

**Wave D — SDK + polish (~2 days)**
14. `@statuswatch/agent` v0.1: `init()`, `diagnose()`, `expressHealth()`, `job(name).run()`. Node only.
15. Heartbeat receiver endpoint.
16. Form monitor type (headless browser, Fly Machines).
17. Billing (Stripe) + enforcement of tier limits.
18. Settings: API keys, member invites.

## 10. Parallel-agent strategy (for when we start)

Once credentials are in place, I'll delegate in parallel:
- Agent A: Supabase schema + Clerk wiring (blocks everything else).
- Agent B: New landing + pricing pages (independent).
- Agent C: Monitor engine + probe worker.
- Agent D: Alerting (email + Telegram bot).
- Agent E: Status page builder.
- Agent F: SDK package scaffold.

Waves are gated: A must finish before C/D/E can integrate with the DB. B, C, D, E, F can then run in parallel.
