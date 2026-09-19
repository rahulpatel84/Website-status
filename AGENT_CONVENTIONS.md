# Conventions for sub-agents (read this before you write code)

## Stack
- Next.js 14 App Router, TypeScript strict
- SQLite via `better-sqlite3` (Postgres/Supabase behind an env flag later)
- Clerk for auth (dev fallback baked in)
- Tailwind + shadcn `components/ui/*`

## Where things live
- Public site (existing outage tracker): `app/(public)/*`
- Authed SaaS app: `app/(app)/app/*` — layout already wired with sidebar + topbar
- Auth pages: `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- API routes: `app/api/*`
- Shared helpers: `lib/*`
- SDK package: `packages/agent/*` (create if it doesn't exist)

## Auth — how every /app/* page reads the user

```ts
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"

export default async function MyPage() {
  const user = await currentUser()   // guaranteed non-null inside /app/*
  if (!user) return null              // layout has already redirected
  const ws = await ensureUserAndWorkspace(user)
  // ... use user.id, ws.id
}
```

Do NOT import Clerk directly. Use `lib/auth.ts` — it handles both Clerk and the dev-mode cookie user.

## DB access — server side only

```ts
import { getDatabase } from "@/lib/database"
const db = getDatabase()
const monitors = db.prepare(
  "SELECT * FROM monitors WHERE workspace_id = ? ORDER BY created_at DESC"
).all(ws.id)
```

Tables you can rely on (all created by `initializeTables()` — don't re-declare):
- `app_users(id, email, name, image_url, created_at)`
- `workspaces(id, name, slug, plan, owner_id, created_at)`
- `workspace_members(workspace_id, user_id, role, created_at)`
- `monitors(id, workspace_id, name, type, target, method, interval_s, regions, config, is_paused, current_status, last_check_at, last_response_ms, created_by, created_at, updated_at)`
- `assertions(id, monitor_id, kind, op, value, created_at)`
- `probes(id, monitor_id, region, status, response_ms, http_status, layer_failed, error, details, ran_at)`
- `incidents(id, monitor_id, workspace_id, started_at, resolved_at, severity, layer_isolated, cause, acknowledged_by, acknowledged_at)`
- `notification_channels(id, workspace_id, kind, label, config, is_verified, created_at)` — `kind` in `email|telegram|slack|webhook`, `config` is JSON string
- `monitor_channels(monitor_id, channel_id)`
- `status_pages(id, workspace_id, slug, name, accent_color, logo_url, visibility, custom_domain, created_at)`
- `status_page_components(id, page_id, monitor_id, group_name, display_name, sort_order)`
- `api_keys(id, workspace_id, label, prefix, hashed_token, last_used_at, created_by, created_at)`
- `heartbeat_checkins(id, monitor_id, received_at, source_ip)`
- `telegram_pairings(code, workspace_id, user_id, expires_at, used_at, chat_id)`

For ID generation use `import { randomUUID } from "node:crypto"` and prefix by entity: `mon_`, `inc_`, `ch_`, etc.

## Design system

- Palette is orange-brand + neutral + semantic. See `app/globals.css`.
- Brand accent: `bg-[color:var(--brand-500)]`, `hover:bg-[color:var(--brand-600)]`, `text-[color:var(--brand-700)]`, `bg-[color:var(--brand-50)]`
- Semantic: `text-[color:var(--status-up)]`, `text-[color:var(--status-degraded)]`, `text-[color:var(--status-down)]`
- Tailwind: `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card`, `bg-background`
- Font: Geist Sans (auto via layout). NO emojis in UI text.
- Shadcn components under `components/ui/` — use `Card`, `Button`, `Input`, `Badge`, etc.
- Icons: `lucide-react`

## Look reference

Match the HTML wireframes at `/Users/rahul/Desktop/Projects/Website-status/wireframes/` for the screen you're building. They're the source of truth for layout + copy.

## Consistency rules

- Container pattern for content pages: `<div className="max-w-6xl">` inside the app layout's `main` (which already has padding).
- Section titles: `<h1 className="text-2xl font-bold tracking-tight text-foreground">` + `<p className="text-sm text-muted-foreground mt-1">`.
- Cards: `className="rounded-xl border border-border bg-card p-5"`.
- Primary buttons: `className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"`.

## What NOT to touch

- `app/globals.css`
- `app/layout.tsx`
- `app/(app)/app/layout.tsx`
- `middleware.ts`
- `lib/auth.ts`, `lib/database.ts` (except adding new **queries** — don't change tables)
- `components/navbar.tsx`, `components/footer.tsx`
- `components/homepage.tsx`, `components/company-monitor-page.tsx`
- `components/comments-section.tsx` and existing SaaS-tracker components
- Any file another agent claims

## Handling missing keys

- If `process.env.RESEND_API_KEY` is unset, `console.log` the email instead of sending. Return `{ok:true, mocked:true}`.
- If `process.env.TELEGRAM_BOT_TOKEN` is unset, skip the actual Telegram POST but still return success.
- Return real errors on validation failures.
