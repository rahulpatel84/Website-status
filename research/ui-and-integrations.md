# UI Palette, Comments, and Twitter/X Integration Research

## 1. Reduced Color Palette

### How the reference dashboards do it
Modern monitoring/status dashboards (Vercel, Linear, GitHub Status, Cloudflare Status, Atlassian Statuspage) converge on the same discipline: **one neutral scale + one accent + three semantic colors**. Vercel and Linear use near-black on off-white with a single accent (blue for Linear, none for Vercel). GitHub and Cloudflare Status pages are almost monochrome, using color only for incident states. Statuspage's default template is white with green/yellow/red pills.

### Best practice count
Total colors on a status page should be **4–5**: one neutral scale (5–6 shades of gray), one accent for interactive elements/links, and three semantic states. Anything more competes with the signal you actually want users to read (is it up or down?). Chart palettes should reuse the semantic colors rather than introduce new blue/purple/yellow lines.

### Recommended palette (Tailwind + hex)

| Role | Light mode | Dark mode | Tailwind |
| --- | --- | --- | --- |
| Background | `#FAFAFA` | `#0A0A0A` | `neutral-50` / `neutral-950` |
| Surface (card) | `#FFFFFF` | `#171717` | `white` / `neutral-900` |
| Border | `#E5E5E5` | `#262626` | `neutral-200` / `neutral-800` |
| Text primary | `#0A0A0A` | `#FAFAFA` | `neutral-950` / `neutral-50` |
| Text muted | `#737373` | `#A3A3A3` | `neutral-500` / `neutral-400` |
| Accent (links, focus) | `#2563EB` | `#3B82F6` | `blue-600` / `blue-500` |
| Up (operational) | `#16A34A` | `#22C55E` | `green-600` / `green-500` |
| Degraded | `#CA8A04` | `#EAB308` | `yellow-600` / `yellow-500` |
| Down (outage) | `#DC2626` | `#EF4444` | `red-600` / `red-500` |

Drop the purple accent and the red-tinted hero gradient — a red hero on a status site reads as "everything is broken." Use a subtle neutral gradient (`neutral-50 → white`) or a solid surface.

### Light vs. dark
Ship **both, default to system**. Status dashboards are checked at 3 AM during incidents, so dark mode matters, but daytime users on shared screens (ops rooms, standups) expect light. Use `next-themes` with `defaultTheme="system"`.

---

## 2. Comment System

### Option comparison

| Option | Anonymous | Real-time | Weight | Fit |
| --- | --- | --- | --- | --- |
| **Custom SQLite** | Native | Yes (existing SSE) | ~5KB extra | Excellent |
| Giscus | No (GitHub login required) | No | Medium | Poor — kills anonymous UX |
| Disqus | Yes but nagged | No | Very heavy (~500KB+, trackers) | Poor — brand feel + privacy |
| utterances | No (GitHub login) | No | Light | Poor — same as Giscus |
| Cusdis | Yes | No native | Light (~15KB) | OK but no upvotes/SSE hooks |

### Recommendation: **custom SQLite**
The site already uses `better-sqlite3` and an SSE endpoint. Third-party widgets can't be wired into your live outage stream, can't do "me too" upvotes, can't tag by issue type, and Giscus/utterances kill the anonymous flow that is the whole point of Downdetector-style reporting.

### Schema
```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  nickname TEXT,                       -- optional, default "Anonymous"
  location TEXT,                       -- from existing geo auto-detect
  body TEXT NOT NULL CHECK(length(body) <= 280),
  issue_type TEXT,                     -- login | slow | 500 | payments | other
  upvotes INTEGER DEFAULT 0,
  parent_id INTEGER REFERENCES comments(id),
  ip_hash TEXT NOT NULL,               -- sha256(ip + daily_salt) for rate limit
  status TEXT DEFAULT 'visible',       -- visible | hidden | flagged
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_comments_company_time ON comments(company_id, created_at DESC);
```

### Real-time features to add
- **SSE fan-out**: reuse the existing endpoint; push `{type: "comment.new" | "comment.upvote"}` events.
- **Upvotes / "me too"**: one row per (comment_id, ip_hash) in a `comment_votes` table.
- **Rate limit**: 3 comments/min and 30/day per `ip_hash`.
- **Moderation**: `bad-words` npm package on write; auto-hide at 5 flags.
- **Threads**: single-level replies via `parent_id` — avoid Reddit-depth nesting on a status page.
- **Location**: prefill from existing geo detect, editable.

---

## 3. Twitter/X Integration

### Embedding options
- **Official widget** (`platform.twitter.com/widgets.js`): 100KB+, blocks render, sets cookies. Avoid.
- **`react-tweet`** (Vercel): SSR, ~10KB, no cookies, but requires a known tweet ID list. Great for a hand-curated "official response" card.
- **Twitter API v2 search**: $100/mo Basic tier minimum for search endpoints, plus rate limits and TOS review. Overkill for MVP.

### Legal / API concerns
Auto-displaying scraped tweets on a company outage page raises three issues: X's TOS forbids non-API display of tweets, GDPR treats tweet authors as data subjects, and misattribution risk during incidents. Skip it for MVP.

### Recommended MVP
1. **Navbar + footer**: X/Twitter icon link to your project account.
2. **Per-company "See tweets" button**: deep-link to X search, e.g.
   `https://twitter.com/search?q=%23{Company}Down%20OR%20%22{company}%20down%22&f=live`
   Opens in a new tab — zero JS cost, zero legal exposure, users get live results.
3. **Optional later**: use `react-tweet` to embed a single pinned "official status" tweet ID that admins paste into the outage record. SSR, no tracking, opt-in per incident.

This gives users the social signal they want without importing X's tracker or paying for the API.
