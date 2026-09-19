# status.watch — what you need to do

The full SaaS platform is built and runs **out of the box** using SQLite for
storage and a dev-mode auto-user for auth (no signup needed). To promote it to
a real, multi-user, production-quality SaaS, you'll switch on the services
below one at a time. Each service is optional — the app degrades gracefully.

---

## 1. First run (no keys required)

```bash
npm install
cp .env.example .env.local     # leave everything blank
npm run dev
```

Open http://localhost:3000. You'll see:

- **`/`** — the public outage-tracker homepage.
- **`/landing`** — the SaaS marketing page (pitch, features, CTA).
- **`/pricing`** — Hobby / Pro / Team plans.
- **`/sign-up`** — creates a dev-mode user via cookie (no email verification).
- **`/app`** — the authed dashboard (redirects to sign-in if not signed in).

Sign up with any email + name — a workspace is auto-created and you're in.

Data is stored in `data/outages.db` (SQLite). Wipe it any time with
`rm data/outages.db*`.

---

## 2. Turn on real auth (Clerk + Google OAuth)

1. Create a Clerk app at https://dashboard.clerk.com.
2. Under **User & Authentication → Social Connections**, enable **Google**.
   Clerk will host the Google OAuth flow for you — no separate Google Cloud
   Console setup unless you want your own OAuth client.
3. Copy the two API keys and paste into `.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```
4. Restart `npm run dev`. `/sign-in` and `/sign-up` now render Clerk's UI
   (email + Google button + magic links). The dev-mode fallback is
   automatically disabled when both keys are present.

Optional: point `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `..._SIGN_UP_URL` if you
customize the routes.

---

## 3. Switch to Supabase (Postgres) — recommended before shipping

Right now data is in SQLite. To move to Supabase:

1. Create a Supabase project at https://supabase.com/dashboard.
2. In **Settings → API**, copy the three values into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
3. Run the migration file (I'll provide `supabase/migrations/0001_init.sql`
   that mirrors the SQLite schema in `lib/database.ts`). Apply via the
   Supabase SQL editor or `supabase db push`.
4. Data-layer swap: once Supabase env vars are set, `lib/database.ts` will
   route to a Postgres client instead of SQLite. (The swap is a small follow-up
   PR — happy to ship it when you have the Supabase project ready.)

Until you do steps 1–4, everything continues to run on SQLite. No breaking.

---

## 4. Email alerts (Resend)

1. Sign up at https://resend.com. Verify a sending domain (or use the test
   `onboarding@resend.dev` sender for local dev).
2. Copy the API key into `.env.local`:
   ```
   RESEND_API_KEY=re_...
   RESEND_FROM_EMAIL=alerts@your-domain.com
   ```
3. Restart. In **Notifications → Email** (`/app/notifications`), click
   "Send test email" to confirm delivery.

Without a Resend key, outgoing emails are logged to the terminal instead of
being sent — the app doesn't crash.

---

## 5. Telegram alerts (bot)

1. Message [@BotFather](https://t.me/BotFather) on Telegram, `/newbot`, pick
   a name (suggest `status.watch alerts`) and username (e.g. `statuswatch_bot`).
2. Copy the token into `.env.local`, and generate a webhook secret:
   ```
   TELEGRAM_BOT_TOKEN=1234567:AA...
   TELEGRAM_BOT_USERNAME=statuswatch_bot
   TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
   ```
   The webhook route rejects any POST whose `X-Telegram-Bot-Api-Secret-Token`
   header doesn't match `TELEGRAM_WEBHOOK_SECRET`.
3. **Local dev — poll instead of expose.** Telegram can't reach `localhost`.
   In a second terminal alongside `npm run dev`, run:
   ```
   npm run telegram:poll
   ```
   This calls `getUpdates` on the Telegram API and forwards each update to
   `http://localhost:3000/api/telegram/webhook` with the shared secret header.
   Nothing on your machine is exposed to the internet.
4. **Production — register the webhook with the secret.** Once deployed on a
   public HTTPS URL:
   ```
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -F "url=https://your-domain.com/api/telegram/webhook" \
     -F "secret_token=$TELEGRAM_WEBHOOK_SECRET"
   ```
   Telegram sends the header on every delivery; the route verifies it.
   Don't run the poller in prod — a webhook and `getUpdates` are mutually
   exclusive, and the poller auto-deletes any registered webhook on startup.
5. In **Notifications → Telegram** (`/app/notifications/telegram`) users get
   an 8-char pairing code and a deep-link to your bot. They send `/start` +
   the code inside Telegram, and the bot links their chat to their workspace.

Without a token: pairing UI still works but no actual Telegram messages fly.
Without a secret: the webhook returns 503 (fail-closed).

---

## 6. Slack (optional)

Slack uses incoming webhooks — no bot required, no env vars for us.
Users paste a channel-specific webhook URL in `/app/notifications`.
Setup instructions: https://api.slack.com/messaging/webhooks.

---

## 7. Cron: keep monitors running

The probe worker lives at **`POST /api/cron/probe`**. It runs every monitor
whose `interval_s` has elapsed, records probe results, opens/resolves
incidents, and dispatches notifications.

The public service directory has a separate worker at
**`GET /api/cron/public-services`**. It checks up to 100 due catalog services
per minute, giving a five-minute cadence for a 500-service catalog. Availability
is stored as five-minute, hourly, and daily rollups, with exact outage start/end
events retained for 183 days. Apply
`supabase/migrations/0002_public_service_history.sql` before deploying; local
development creates the equivalent SQLite tables automatically.

Authentication: `Authorization: Bearer $CRON_SECRET` header.

Options:
- **Vercel Cron** (recommended): add a `vercel.json` entry — I'll drop this in.
- **cron-job.org / EasyCron**: hit the URL on your schedule (every minute or
  every 30 seconds).
- **Local dev**: hit it manually with `curl`.

Set the secret in `.env.local`:
```
CRON_SECRET=<something long and random>
```

Without a secret set, the endpoint only accepts requests from localhost.

---

## 8. Publish the SDK

The npm package lives at `packages/agent/`. It's the
`@statuswatch/agent` module that users install in their apps.

To publish:
1. `cd packages/agent && npm login` (with your npm account).
2. Reserve the scope: `npm access` → configure `@statuswatch` (or use your
   own scope like `@yourname/agent`; update `packages/agent/package.json` +
   the `/app/agent` page docs accordingly).
3. `npm publish --access public`.

The SDK's default endpoint is `https://api.statuswatch.io/ingest`. Change
that to your deployed URL in `packages/agent/src/index.ts` before publishing.

---

## 9. Domain + deployment

- Deploy to **Vercel** — one-click, works with the Clerk / Supabase / Resend
  env vars in the Vercel dashboard.
- Point your domain at Vercel.
- Update `NEXT_PUBLIC_APP_URL` in `.env.local` (and Vercel env) to your
  production URL — used for heartbeat URLs, absolute status-page links, and
  webhook signatures.

---

## 10. Optional: Stripe billing

Not wired yet. When you're ready to charge:
1. Create a Stripe account, add products for Pro ($19) and Team ($79).
2. Add the price IDs + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to
   `.env.local`.
3. I'll add `/api/billing/*` routes + upgrade CTAs in the settings page.

---

## Reality check — what works today with zero setup

| Feature | Zero setup | Needs keys |
| --- | --- | --- |
| Public outage tracker (existing) | ✅ | — |
| Comments on tracker pages | ✅ | — |
| SaaS landing + pricing | ✅ | — |
| Sign up / sign in (dev cookie) | ✅ | Clerk to make it real |
| Dashboard + monitor CRUD | ✅ | — |
| Monitor probe engine + diagnostic waterfall | ✅ | — |
| Incidents log | ✅ | — |
| Status page builder | ✅ | — |
| Public branded status pages | ✅ | — |
| Email alerts | Mocked to console | Resend |
| Telegram alerts | Pairing UI only | Telegram bot |
| Slack alerts | Webhook accepted | — |
| Real multi-tenant Postgres | SQLite | Supabase |
| Cron-driven monitoring | Manual `curl` | Vercel Cron or similar |
| SDK / agent install-in-project | Package built | Publish to npm |

Nothing above breaks without keys. Every path returns a helpful response.

---

## Summary of what YOU do

1. **Sign up for Clerk, Supabase, Resend, @BotFather.** Paste keys into `.env.local`.
2. **Run the Supabase migration** to move from SQLite to Postgres.
3. **Deploy to Vercel**, add the env vars there too.
4. **Set up a cron** hitting `/api/cron/probe` every 30s or 60s.
5. **Publish the SDK** to npm under your scope.
6. **Point Telegram's webhook** at your prod URL after deploy.

That's it. Everything else is code you can run today.
