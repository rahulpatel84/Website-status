# Deployment guide — Vercel + Supabase + Fly.io

Three-tier deploy:
- **Vercel** — Next.js app (UI, API routes, auth, incident dispatch)
- **Supabase** — Postgres database + object storage
- **Fly.io** — long-lived worker that pings cron endpoints every 30s (Vercel Cron's floor is 1 min)

Also see: live plan page at `/plan` when the app is running.

---

## 1. Supabase — Postgres + storage

### 1a. Create the project
1. supabase.com → **New project** → pick a region close to your Vercel region.
2. Settings → API. Grab three values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret key` → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose)

### 1b. Apply the schema
Either via CLI:
```bash
supabase link --project-ref <ref>
supabase db push
```

Or paste each migration into Supabase Dashboard → SQL Editor, in order:
- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_public_service_history.sql`
- `supabase/migrations/0003_notification_cadence.sql`

### 1c. (Optional) Create the storage bucket
For screenshots via Supabase Storage instead of Vercel Blob:
- Dashboard → Storage → **New bucket** → name `probe-shots`, mark **Public**.
- Set env: `SUPABASE_STORAGE_BUCKET=probe-shots`.

### 1d. One-shot data copy (SQLite → Postgres)
Only needed if you want to preserve local dev data. For a fresh cutover, skip.
```bash
# Dump SQLite as SQL, hand-fix the differences (AUTOINCREMENT → SERIAL,
# DATETIME → TIMESTAMPTZ, backticks → double-quotes), then pipe to psql.
sqlite3 data/outages.db .dump > /tmp/sqlite-dump.sql
# Edit /tmp/sqlite-dump.sql — remove CREATE TABLE statements (schema already
# applied via migrations), keep only INSERTs. Then:
psql "$SUPABASE_DB_URL" < /tmp/sqlite-dump.sql
```
For anything non-trivial, prefer per-table `INSERT INTO … SELECT` scripts.

---

## 2. Vercel — Next.js app

### 2a. First deploy
```bash
npm i -g vercel
vercel                    # links the repo, creates the project
vercel env pull .env.local # optional: pull anything you've already set
```

### 2b. Environment variables
Project → Settings → Environment Variables. Paste in everything from your
`.env.local` (or the values above). Minimum for prod:

| Key | Where from |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard |
| `CLERK_SECRET_KEY` | Clerk dashboard |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase (step 1a) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (step 1a) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (step 1a) |
| `RESEND_API_KEY` | Resend |
| `TELEGRAM_BOT_TOKEN` | @BotFather |
| `CRON_SECRET` | any secret, e.g. `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | your Vercel domain (`https://…vercel.app` or custom) |

### 2c. Vercel Blob for screenshots
- Project → Storage → **Create Database** → **Blob** → follow the prompts.
- Vercel auto-injects `BLOB_READ_WRITE_TOKEN` into your project env.
- `lib/blob-storage.ts` auto-detects and switches over.
- Install the dep once locally: `npm i @vercel/blob`, then push.

### 2d. Ship
```bash
vercel --prod
```

Vercel Cron takes over the three schedules in `vercel.json`:
- `/api/cron/probe` every minute (safety-net for user monitors)
- `/api/cron/public-services` every minute (safety-net for the 100-site catalog)
- `/api/cron/screenshot-cleanup` daily at 03:17 UTC

The Fly worker (step 3) provides the fast 30s cadence on top.

---

## 3. Fly.io — worker

### 3a. Install & login
```bash
brew install flyctl        # or: curl -L https://fly.io/install.sh | sh
fly auth login
```

### 3b. Launch (from repo root)
```bash
fly launch \
  --dockerfile worker/Dockerfile \
  --copy-config \
  --name status-watch-worker \
  --no-deploy
```
Answer `n` to everything except region. Fly reads `worker/fly.toml`.

### 3c. Set secrets
Same `APP_URL` your Vercel deployment uses, same `CRON_SECRET` you set on Vercel.
```bash
fly secrets set \
  APP_URL=https://your-app.vercel.app \
  CRON_SECRET=<same as Vercel>
```

### 3d. Deploy
```bash
fly deploy --dockerfile worker/Dockerfile
fly logs      # watch it start ticking
```

Every 30 seconds you should see:
```
[2026-…] ok · checked=100 up=98 down=2 · 412ms
```

---

## 4. Verification checklist

- [ ] `/plan` on your Vercel domain renders the deploy status board
- [ ] `/services` shows all 100 sites and one has non-`—` response times
- [ ] Create a monitor → within 30s it shows a probe result
- [ ] `fly logs` shows tick lines every 30s
- [ ] Supabase → Table Editor → `probes` has rows being added
- [ ] Take a monitor down, wait a minute, get a Telegram alert with the new
      formatted message + "Open in status.watch →" link

---

## Rollback

- **Vercel**: `vercel rollback` to previous deployment.
- **Fly**: `fly releases list` → `fly deploy --image <prev-image>`.
- **Supabase**: schema changes are additive (no destructive migrations) so
  no rollback needed for schema. Row data would need a point-in-time restore
  (paid tier) or a manual undo.

---

## Costs (rough, 2026)

| | Free tier fits? | Paid start |
|---|---|---|
| Vercel Hobby | Yes for <100 GB/mo bandwidth | $20/mo Pro |
| Supabase Free | Yes for <500 MB DB, <5 GB storage | $25/mo Pro |
| Fly.io | 3 shared-cpu-1x machines free | $2-5/mo above free |

For a status-page project doing 100 sites × 30s checks × 30 days = ~8.6M checks/mo, expect to land in paid Supabase pretty quickly (each check writes ~1 KB). Budget accordingly.
