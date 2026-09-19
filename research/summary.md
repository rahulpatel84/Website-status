# Website Status — Redesign Research Summary

Consolidates findings from `competitors.md` and `ui-and-integrations.md` into a single, actionable plan.

---

## 1. What the site is today

Next.js 14 App Router + SQLite (`better-sqlite3`) + SSE. Two routes: `/` (searchable grid of 8 companies) and `/[company]-website-monitor`. Feature-complete for reporting + heatmap + charts, but missing: comments UI, product/info pages, Twitter integration, cohesive nav/footer, and a restrained visual identity.

## 2. Reduced color palette (the "reduce colors" ask)

Every serious monitoring dashboard converges on **1 neutral + 1 accent + 3 semantic** colors. Current site uses purple accent, red hero gradient, plus green/blue/yellow chart colors — it reads busy and a red-tinted homepage falsely signals "everything is down."

**New palette (Tailwind + hex):**

| Role | Light | Dark |
| --- | --- | --- |
| Background | `neutral-50` `#FAFAFA` | `neutral-950` `#0A0A0A` |
| Surface | `white` | `neutral-900` `#171717` |
| Border | `neutral-200` `#E5E5E5` | `neutral-800` `#262626` |
| Text | `neutral-950` | `neutral-50` |
| Muted | `neutral-500` `#737373` | `neutral-400` `#A3A3A3` |
| Accent (links, CTAs) | `blue-600` `#2563EB` | `blue-500` `#3B82F6` |
| Up / OK | `green-600` `#16A34A` | `green-500` `#22C55E` |
| Degraded | `yellow-600` `#CA8A04` | `yellow-500` `#EAB308` |
| Down | `red-600` `#DC2626` | `red-500` `#EF4444` |

Drop the purple accent, drop the red-tinted hero. Default to `system` theme via `next-themes`.

## 3. Information architecture (from competitor sweep)

Every one of Downdetector / StatusGator / IsItDownRightNow / UptimeRobot / Statuspage has these pages. This is the target IA:

**Public routes to add:**
- `/` — hero + trending outages + searchable directory
- `/services` — full A–Z directory (SEO)
- `/[company]-website-monitor` — existing detail page (redesign)
- `/[company]-website-monitor/history` — historical incidents
- `/[company]-website-monitor/map` — full-screen heatmap
- `/about` — mission, team, data sources
- `/how-it-works` — reporting → aggregation → alerting explained
- `/faq` — top 15 questions
- `/contact` — form + email + social
- `/api` — public API docs (leverages existing endpoints)
- `/blog` — outage post-mortems, SEO
- `/legal/privacy`, `/legal/terms`, `/legal/cookies`

**Navbar (final):** Logo | Services | Report an outage | How it works | About | (theme toggle) | (X icon)

**Footer (4 columns):**
- **Product:** Services · Report outage · API · Status page
- **Company:** About · How it works · Blog · Contact
- **Legal:** Privacy · Terms · Cookies
- **Follow:** X/Twitter · GitHub · RSS

## 4. Features worth stealing (top 10)

1. 24-hour reports bar chart with baseline/expected-volume overlay
2. Live geographic heatmap (already have)
3. "Most reported problems" category breakdown
4. Incident state machine: **Investigating → Identified → Monitoring → Resolved**
5. Impact chips: **None / Minor / Major / Critical** (black/yellow/orange/red)
6. Subscribe (email / RSS / webhook) on a per-service page
7. One-click "I have a problem" modal with issue-type dropdown (already have)
8. Related/similar services cross-links (SEO win)
9. Response-time sparkline
10. Ingest official vendor status pages as a secondary signal (later)

## 5. Comment system — build custom on SQLite

Third-party widgets (Disqus, Giscus, utterances) either kill Core Web Vitals or require login, breaking the anonymous flow that Downdetector-style sites depend on. Site already runs `better-sqlite3` + SSE. Build custom.

**Schema (`comments` table):**
```
id, company_slug, issue_type, nickname (optional), location (auto from IP),
body (280 char cap), upvotes, parent_id (single-level threading only),
ip_hash (salted, for rate limit + dedupe voting),
status (visible | hidden | flagged), created_at
```
Plus a `comment_votes` table keyed by `ip_hash` to prevent double-voting.

**UX rules:**
- Anonymous by default; optional nickname; no signup.
- Rate limit: 3/min, 30/day per hashed IP.
- `bad-words` npm filter on write; auto-hide at 5 flags.
- Reactions: single "Same here" (+1) button — matches Downdetector's model.
- Live update via existing SSE endpoint (`comment.new`, `comment.upvote` events).
- One reply level only. No Reddit-style depth.

## 6. Twitter/X integration — link, don't embed

Official embed is 100 KB+ and cookies-heavy. API v2 costs $100/mo. Auto-scraping tweets has TOS + GDPR risk.

**MVP:**
1. X icon in navbar + footer → your project X account.
2. Per-company **"See mentions on X"** button → deep link:
   `https://x.com/search?q=%23{Company}Down%20OR%20%22{company}%20down%22&f=live`
3. Later: `react-tweet` for a single admin-pinned tweet ID per active incident (SSR, no cookies).

## 7. Robustness features to add

- Email/RSS/webhook subscribe per service
- Incident detail pages with state machine + timeline
- Public JSON API + OpenAPI docs page
- User-agent + device detection breakdown on reports (already collecting UA)
- Rate-limiting middleware on `/api/report-outage`
- Bad-word filter + IP hashing on comments
- SEO: `sitemap.xml`, `robots.txt`, structured data (`Organization`, `WebSite`, `FAQPage`)
- Dark mode via `next-themes` (already installed)

## 8. Wireframe deliverables

Static HTML wireframes at `/wireframes/` for:
1. `home.html` — new homepage with trending, directory, reduced palette
2. `company.html` — redesigned per-service page with comment section
3. `services.html` — A–Z directory
4. `about.html`, `how-it-works.html`, `faq.html`, `contact.html`
5. `api.html` — public API docs
6. `incident.html` — incident detail with state machine
7. `_shared/navbar.html`, `_shared/footer.html` — shared partials referenced as visuals

Wireframes use only the reduced palette above so we can validate the visual before touching React.
