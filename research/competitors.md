# Competitor Research — Outage Monitoring Sites

Compiled 2026-09-05. Sources: live fetches of statusgator.com, uptimerobot.com, isitdownrightnow.com, atlassian.com/software/statuspage, plus targeted web searches for Downdetector and Downforeveryoneorjustme (both blocked WebFetch with 403 — details reconstructed from public documentation and third-party writeups).

---

## 1. Downdetector.com

- **Navbar:** Logo | Search bar | Country selector | "Companies" | "Report a problem" | About | Login (Downdetector Enterprise)
- **Footer sections:** About Downdetector, How it works, FAQ, Contact, API / Enterprise, Downdetector Blog, Press, Legal (Privacy, Terms, Cookie policy), Country switcher, Social (X, Facebook, LinkedIn)
- **Pages/routes:** `/`, `/status/<service>/`, `/status/<service>/map`, `/status/<service>/history`, `/companies/`, `/about/`, `/how-it-works/`, `/faq/`, `/contact/`, `/api/` (Enterprise), `/blog/`
- **Per-service page structure (top to bottom):**
  1. "User reports indicate…" status banner (green/orange/red)
  2. 24-hour reports bar chart (reports vs baseline)
  3. "Most reported problems" pie/breakdown (Login, App, Website, Server connection)
  4. Live outage heatmap of user reports by city/region
  5. "Most affected locations" ranked city list
  6. "I have a problem with X" report button (opens problem type modal)
  7. Comments/Tips feed
  8. Related/similar services
- **Comment system:** Near-real-time feed, flat (not threaded), shows relative timestamp ("2 min ago"), city/region (geo-IP), and problem category tag. Upvote via "Thanks" reaction. Moderation via automated profanity filter + community flagging. No login required.
- **Twitter/X:** Historically embedded live tweets ("Latest tweets about X outage"). Post-API-lockdown they now show mentions volume as a chart and link to X search rather than embedding tweets. Own X handle linked from footer.
- **Color palette:** Downdetector red `#EE0000` primary, white background, dark gray text `#2B2B2B`, status green `#4CAF50`, warning orange `#F5A623`, chart gray `#E5E5E5`.

## 2. StatusGator.com

- **Navbar:** Use cases | Features | Pricing | Integrations | Blog | Sign in | Sign up
- **Footer sections:** Use Cases (IT teams, DevOps, Education, Enterprise, MSPs, Competitive intelligence, E-commerce, SaaS); Features (Status page, Aggregation, Cloud, Website, Ping, Incidents, Early Warning); Pricing (Business, Education); More (About, Media, Service directory, Integrations, Browser extension, Support, Blog, Changelog, Trust/Security, Privacy, Terms, FAQs); Popular Services (AWS, Azure, Cloudflare, GitHub, Google Cloud/Workspace, Teams, M365, Okta, OpenAI, Salesforce, Slack, Zoom)
- **Routes:** `/`, `/use-cases/*`, `/features/*`, `/plans`, `/integration/*`, `/services/<slug>`, `/blog`, `/about`, `/trust`, `/privacy`, `/terms`
- **Aggregation model:** Scrapes 10,540+ official vendor status pages + independent uptime monitors + crowdsourced "Early Warning Signals" (their term for user-reported anomalies).
- **Comment system:** None on public service pages; incident notes are vendor-authored only.
- **Twitter/X:** No embeds; links to own account.
- **Color palette:** Dark navy/charcoal primary, white background, muted blue accents `#3B82F6`-ish, gray UI chrome. Professional/minimalist.

## 3. IsItDownRightNow.com

- **Navbar:** Home | Website Status | News | Contact
- **Footer:** Terms of Service | Privacy Policy | Contact Us | copyright line
- **Routes:** `/`, `/<domain>.html`, `/news.html`, `/contact.html`
- **Per-service page structure:** Header/logo → Server status check (green "UP" / red "DOWN") → Response-time history graph (last-10-checks bar chart) → Status history table → Troubleshooting instructions → Comment form → 5-star rating widget → Similar sites → Currently down sites → Recently checked sites → Bookmarklet → Footer
- **Comment system:** Facebook-comments plugin. Real-time (via FB), flat, shows FB name + avatar + relative timestamp. Country/ISP/browser inferred from server. No native reactions beyond FB likes. Moderation via Facebook.
- **Twitter/X:** None embedded.
- **Color palette:** White background, black body text, orange accent `#F58220`, status green `#4CAF50` / red `#D9534F`, blue response-time bars `#337AB7`.

## 4. UptimeRobot.com

- **Navbar:** Product (Website/Keyword/Ping/Port/Cron/DNS/SSL monitoring, Status Pages) | Integrations | Pricing | Solutions | Resources (Blog, Docs, Knowledge Hub) | Log in | Sign up free
- **Footer:** Product, Solutions, Company (About, Careers, Contact), Resources (Blog, Help, API docs, Status), Legal (Privacy, Terms, GDPR), Social
- **Routes:** `/`, `/website-monitoring/`, `/keyword-monitoring/`, `/ping-monitoring/`, `/port-monitoring/`, `/cron-job-monitoring/`, `/dns-monitoring/`, `/status-page/`, `/integrations/`, `/pricing/`, `/api/`, `/knowledge-hub/*`, `/case-studies/*`
- **Dashboard patterns:** Monitor list with color-dot status, uptime %, response time sparkline; incident log per monitor; public status pages (customizable slug/domain); maintenance windows; role-based access; multi-channel alerts (email/SMS/Slack/webhook).
- **Comments:** N/A (B2B tool).
- **Color palette:** Teal/green primary `#00B67A`-ish, white background, dark gray text, orange incident accent.

## 5. Statuspage.io (Atlassian)

- **Navbar:** Features | Page types (Public/Private/Audience-specific) | Pricing | Enterprise | Language | "Get it Free"
- **Footer:** Company (careers, events, blogs, contact), Products (Jira, Confluence, Loom, Trello, Bitbucket), Resources (support, licensing, templates, marketplace), Learn (partners, training, docs), Legal (privacy, terms, impressum)
- **Incident detail page structure:**
  - Incident title + current state chip: **Investigating → Identified → Monitoring → Resolved**
  - Impact severity: **None (black), Minor (yellow), Major (orange), Critical (red)**
  - Affected components list (each with its own status)
  - Reverse-chronological updates timeline (author + timestamp + message)
  - Subscribe box (email / SMS / RSS / Slack / webhook / Atom)
  - "Posted X ago" metadata
- **Comments:** No public comments — one-way vendor communication.
- **Twitter/X:** Optional auto-post to configured X account when incident is created/updated.
- **Color palette:** Atlassian blue `#0052CC`, white, status green/yellow/orange/red per severity.

## 6. Downforeveryoneorjustme.com

- **Navbar:** Logo only (minimal). Sometimes a "Contact"/"About" link.
- **Footer:** Copyright, small legal links.
- **Routes:** `/`, `/<domain>.com` (dynamic result page)
- **Structure:** Giant centered input "Or just me?" → single verdict sentence ("It's just you. http://x.com is up.") → optional tweet/share button → similar recently-checked list.
- **Comments/Twitter:** None (or a share-to-X link only).
- **Color palette:** White background, black text, single blue link accent — deliberately spartan.

---

## Synthesis

### Top 10 features worth stealing
1. **24-hour reports bar chart with baseline overlay** (Downdetector) — instantly conveys spike severity.
2. **Live geographic heatmap of reports** (Downdetector) — already in your app; keep front-and-center.
3. **"Most reported problems" breakdown** by category (Login, App, Server, Payments) — high value, low effort.
4. **Incident state machine** — Investigating/Identified/Monitoring/Resolved (Statuspage).
5. **Impact severity chips** — None/Minor/Major/Critical color-coded (Statuspage).
6. **Subscribe-to-updates** via email/RSS/webhook (Statuspage/StatusGator).
7. **"I have a problem with X" one-click report with problem-type modal** (Downdetector).
8. **Related/similar services** cross-links (all sites) — big SEO win.
9. **Response-time sparkline** per monitor (UptimeRobot) — cheap visual polish.
10. **Aggregated official status-page ingestion** (StatusGator) — differentiator vs pure-crowdsourced.

### Common information architecture (present on every site)
- Home with search + trending outages
- Per-service page: status verdict, chart, history, report button
- About / How it works
- FAQ
- Contact
- Legal: Privacy, Terms, Cookies
- Blog / News
- API or Developers
- Companies/Services directory (A–Z index)

### Comment system recommendation — Custom SQLite-based
You already run SQLite (`data/outages.db-shm` in the repo). **Build a custom lightweight system**, do not integrate Disqus or Giscus:
- Disqus is ad-heavy, slow, hurts Core Web Vitals, and users associate it with spam.
- Giscus requires GitHub login — wrong audience for a public outage site.
- Custom lets you tie comments to `outage_id` + `service_id`, add geo-IP city/region tags, problem-category dropdown, and a "Same here / +1" reaction — matching Downdetector's proven model.
- Add rate-limit (per IP), a profanity filter (`bad-words` npm), and community flagging. No login required; store hashed IP + optional display name.
- Bonus: comments become a real-time signal you can feed into your outage detection algorithm.

### Twitter/X integration recommendation — Link, don't embed
- **Do not embed** the X timeline widget: rate-limited since 2023, requires paid API, slow to load, and X occasionally breaks the embed script entirely.
- **Do link**: a "See mentions on X" button that opens `https://x.com/search?q=<service>%20down&f=live` in a new tab. Zero cost, always works.
- If you later want richer signal, poll the free Nitter/X search RSS in a cron job and render mention-volume as your own chart (Downdetector's current approach).
- Keep a footer link to your own X account for outage announcements.
