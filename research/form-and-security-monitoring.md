# Form-Load / Form-Submit and Security Monitoring — Research

Compiled 2026-09-05 for status.watch. Purpose: extend our current DNS→TCP→TLS→HTTP→body waterfall with (a) real browser-based form checks and (b) defensive continuous security monitoring on customer-owned assets. Ends with a concrete monitor-type proposal and a ship order.

---

## Part 1 — Browser-based synthetics (form load + submit)

### Checkly
- **Test surface:** Full Playwright API. Real Chromium (Firefox/WebKit optional). Any locator, `page.fill`, `page.click`, `expect(locator).toBeVisible()`, screenshots on failure, video, trace viewer, console-error assertions, network waterfalls, Core Web Vitals (LCP/CLS/INP) exported as native metrics, custom check-groups with shared login snippets.
- **Execution model:** Fully hosted. Runs in Checkly-managed AWS regions (~20 public locations). "Private locations" via their agent for VPCs. No BYO runner needed. Cold start ~2–5s per run because Playwright browsers are pre-warmed on their runners.
- **Config:** TypeScript/JS Playwright spec files, versioned via `checkly.config.ts` monorepo and `checkly deploy` CLI (Pulumi-style monitoring-as-code). GUI editor exists but the pitch is code-first.
- **Cost:** Team plan ~$80/mo includes 10k browser check runs; overage ~$0.008–$0.01 per run. API checks are ~$0.0002 each. So browser checks are ~40–50× the price of API checks.
- **Cold-start:** Sub-5s from schedule to first `page.goto`.

### Datadog Synthetics
- **Test surface:** Two flavors — **API tests** (multi-step HTTP with assertions on status, body, headers, JSON path, response time, SSL cert expiry) and **Browser tests** (recorded via a Chrome extension or authored in a JSON step DSL). Browser tests support click/fill/select/assert-element/assert-URL/screenshot/JS custom step, plus subtests (chained flows), variables/globals, MFA via TOTP secret, and mobile emulation.
- **Execution model:** Managed locations globally, plus **private locations** (Docker container you run inside your VPC). Serverless from the customer perspective.
- **Config:** GUI-first (recorder). JSON/Terraform export for Git storage. No raw Playwright — proprietary step schema.
- **Cost:** ~$5 per 1,000 API tests, ~$12 per 1,000 browser tests (annual pricing tier). Real per-run cost ~$0.012 browser.
- **Cold-start:** 3–8s; slower than Checkly in practice because of DD's telemetry attach.

### BetterStack (Better Uptime)
- **Test surface:** Standard uptime + **"advanced monitors"** which do keyword/regex on response body, form-submit via configured POST payload (still HTTP, not browser). They added **Playwright monitors** in 2024: upload a real `.spec.ts`, they run it on schedule.
- **Execution model:** Hosted, no private runner option in the SMB plan.
- **Config:** Uptime GUI for basic; Playwright script upload (raw JS) for advanced.
- **Cost:** Playwright monitors are gated to the ~$25/mo team plan and priced per run (approx $0.006). Cheaper than Checkly, less mature (no trace viewer, limited debugging).
- **Cold-start:** ~4–7s.

### UptimeRobot
- **Test surface:** URL/keyword/port/ping/heartbeat/SSL/DNS. **Keyword monitor** = static string presence in raw HTML response. No JS execution, no form fill, no browser. This is the tier below what we need.
- **Cost:** Free for 50 monitors at 5-min interval; Pro $7/mo.
- **Verdict:** Direct competitor to our current waterfall, not a browser-check reference.

### Cypress Cloud
- **Test surface:** Cypress runner is CI-oriented, not scheduled synthetics. Cypress **Cloud** records test runs and provides flake analysis. Not a monitoring product — irrelevant except as a config-format reference.

### Open-source runtimes (self-hosted feasibility)

| Runtime | Bundle size | Vercel serverless viable? | Fly.io Machines viable? |
|---|---|---|---|
| **Playwright** (chromium-headless) | ~170 MB chromium + ~50 MB node_modules | **No** — busts Vercel's 250 MB unzipped limit and 60s max even on Pro. `@sparticuz/chromium` shim + Playwright is possible on Lambda (~50 MB gzipped) but flaky and not a fit for our Next.js worker. | **Yes** — 1 GB Machine image, 256 MB–1 GB RAM, cold-start ~1.5s (image cached), warm run ~500 ms. Recommended path. |
| **Puppeteer** | Similar to Playwright | Same limits | Same as Playwright. Older API, weaker locator engine — no reason to prefer. |
| **Selenium** | Java/grid, heavy | No | Overkill; only useful for cross-browser matrix. |
| **Browserless.io** | Hosted `wss://` endpoint | **Yes** — our Node worker just opens a websocket, no chromium bundled locally. | Same. $50/mo starter (1k concurrent-hour), $200/mo scale plan. Fast integration path. |

**Recommendation for our worker:** Playwright on Fly.io Machines for our own runner (auto-stop when idle → ~$3/mo per region), fallback to Browserless.io as a managed option we can flip on for customers on the top plan.

---

## Part 2 — Defensive security monitoring

### SSL Labs (Qualys)
- **API:** Public REST API at `https://api.ssllabs.com/api/v3/analyze?host=...`. Returns full JSON: overall grade (A+ → F), per-endpoint cipher list, protocol support (TLS 1.0–1.3), HSTS, certificate chain, key exchange, OCSP stapling.
- **Free-tier limits:** ~25 assessments/day per IP, one active scan per hostname, results cached ~24h. Terms explicitly forbid commercial resale but allow monitoring-tool integration if the grade is shown to the domain owner.
- **Signal:** A+/A/B/C/D/F letter grade + granular issue list.
- **Legal:** Scanning a domain's public TLS endpoint = passive, no consent needed. Reselling raw SSL Labs data = requires their commercial agreement.

### Mozilla Observatory (v2)
- **API:** REST at `https://observatory-api.mdn.mozilla.net/api/v2/scan?host=...`. Returns JSON with header-by-header pass/fail, score 0–130, letter grade A+ → F.
- **Free-tier limits:** No stated hard rate limit but "reasonable use"; ~1 scan/min/host is fine.
- **Signal:** Grade + itemized header checks (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, SRI, cookies, redirection).
- **Legal:** Same — passive header fetch.

### securityheaders.com (Scott Helme)
- **API:** Unofficial — `GET https://securityheaders.com/?q=<host>&followRedirects=on&hide=on` with `X-Score` and `X-Grade` response headers. Simple grader; less depth than Observatory.
- **Free-tier limits:** Fair-use; recommended to build our own parser and only use securityheaders.com as a sanity check.
- **Verdict:** We should implement our own header parser (trivial — 30 lines of Node) and skip the external dep.

### testssl.sh
- **Not an API** — CLI tool, ~5-min run against a host. We'd shell out on Fly.io Machine.
- **Signal:** Very deep — every cipher, vuln check (Heartbleed, POODLE, ROBOT, LOGJAM, BEAST, LUCKY13, SWEET32), certificate transparency.
- **Cost:** Free, self-hosted. Slow — not for high-frequency polling; run daily.

### Detectify
- **Product:** Application Scanning + Surface Monitoring. Discovers subdomains, runs OWASP-style crawler with 2,000+ payloads, reports CVEs.
- **API:** REST for reading findings, no self-serve scanner-as-a-service resale.
- **Pricing:** From ~$289/mo for Surface Monitoring, ~$89/asset/mo for App Scanning. Enterprise.
- **Positioning:** True DAST — sends payloads, needs explicit customer authorization (their onboarding includes a signed scanning agreement).
- **Verdict:** Out of scope for us — we'd effectively be reselling a scanner. Consider as a "premium integration" later.

### Intruder.io
- **Product:** Continuous vuln scanning (uses Tenable/Nessus under the hood + their own layer).
- **API:** REST for triggering scans, reading issues, exporting. Good for integration.
- **Pricing:** From ~$113/mo for essential (1 target), scales fast.
- **Verdict:** Reference point for how to structure "continuous scan → issue tracker" UX. Not something to embed.

### HackerTarget
- **API:** Cheap REST endpoints for DNS lookup, reverse DNS, WHOIS, subdomain discovery, nmap-lite port scan, HTTP header fetch.
- **Free-tier limits:** 100 requests/day free; paid $10/mo for 3k.
- **Legal:** They handle the port-scan legal boundary — their ToS says the caller warrants ownership. Useful to offload the sketchy stuff.

### Snyk
- **CVE side, source-code-integrated.** Requires app-repo access. Out of our lane — we monitor URLs, not repos. Skip.

### Certificate Transparency (crt.sh, Google CT log APIs)
- **API:** `https://crt.sh/?q=%25.<domain>&output=json` — free, no auth, returns every cert issued for the domain. Useful for detecting rogue/new subdomains.
- **Signal:** New cert issued → new subdomain appeared → alert.
- **Legal:** 100% passive public log data.

### Content-hash / defacement detection
- **No external API needed.** Fetch HTML, strip volatile bits (timestamps, CSRF tokens, nonces), hash it, compare to baseline. Alert on delta > threshold. Add screenshot diff (pixelmatch) for visual defacement.

### Cookie flags & CSP
- Parse `Set-Cookie` headers ourselves. `cookie` npm package + a 20-line policy checker. Same for CSP — `csp-parser` npm package or roll our own.

### DNS hygiene (SPF, DKIM, DMARC)
- Pure Node `dns.resolveTxt('_dmarc.<domain>')`, parse against spec. No external dep. Well-trodden ground (dmarc-parser, spf-parser on npm).

### Open port scan
- `nmap` shelled from Fly Machine. **Legally borderline** without explicit customer consent — even against a domain the customer "owns," if it resolves to a shared host (Cloudflare, Vercel) we could hit third-party infrastructure. **Require a signed scanning authorization checkbox before enabling.**

---

## Implementation Recommendation for status.watch

Add these four monitor types (in priority order):

### 1. `security-headers` (ship first — cheapest, safest, differentiating)
- **Config schema:**
  ```yaml
  type: security-headers
  url: https://example.com
  min_grade: B          # alert if worse
  require:              # explicit must-have list
    - Strict-Transport-Security
    - Content-Security-Policy
    - X-Content-Type-Options
  interval: 6h
  ```
- **Probe:** Pure Node in existing worker. Single `fetch()`, parse response headers, run our own grader (port Mozilla Observatory scoring rubric — MIT-licensed, ~200 lines). Optionally cross-check against Mozilla Observatory API weekly.
- **Cost per probe:** ~$0.00001 (one HTTP HEAD/GET).
- **Runtime:** Existing Node worker — no browser needed.

### 2. `ssl-grade` (ship second — one API call, high-signal)
- **Config schema:**
  ```yaml
  type: ssl-grade
  host: example.com
  port: 443
  min_grade: A
  expiry_warn_days: 30
  interval: 24h         # SSL Labs caches 24h anyway
  ```
- **Probe:** Call SSL Labs API v3 with `startNew` then poll `getStatus`. Cache 24h. Fall back to native `tls.connect` + cert parse if SSL Labs quota exceeded.
- **Cost per probe:** Free from SSL Labs (25/day/IP); we'll rotate probe IPs across Fly regions to scale.
- **Runtime:** Existing Node worker.

### 3. `browser` (ship third — biggest UX leap, biggest infra lift)
- **Config schema:**
  ```yaml
  type: browser
  url: https://example.com/login
  script: |
    await page.goto(url);
    await expect(page.locator('#email')).toBeVisible();
    await page.fill('#email', 'test@status.watch');
    await page.fill('#password', env.TEST_PASSWORD);
    await page.click('button[type=submit]');
    await expect(page).toHaveURL(/\/dashboard/);
  assertions:
    - no_console_errors: true
    - lcp_ms_max: 2500
  interval: 15m
  regions: [iad, fra, syd]
  ```
- **Probe:** Playwright + Chromium in a Fly.io Machine image. Boot on demand (`auto_stop_machines = true`), run test, upload trace/screenshot to R2, tear down. Reuse image across customers.
- **Cost per probe:** ~$0.002 (Fly shared-cpu-1x for ~10s per run + storage). ~5× cheaper than Checkly retail.
- **Runtime:** **Not** the existing Node worker — dedicated Fly Machine pool. Node worker enqueues jobs; Machines pick up via a Redis/Postgres queue.

### 4. `content-hash` (ship fourth — cheap, defacement/change detection)
- **Config schema:**
  ```yaml
  type: content-hash
  url: https://example.com
  strip_selectors: ['.timestamp', 'meta[name=csrf-token]']
  alert_on_change: true
  interval: 1h
  ```
- **Probe:** Fetch HTML, run through cheerio to strip volatile selectors, SHA-256, compare to previous. Store last 30 hashes.
- **Cost per probe:** ~$0.00001.
- **Runtime:** Existing Node worker.

Deferred for a later phase: `port-scan` (needs customer signed authorization + Fly Machine with nmap), `cert-transparency` (crt.sh polling → new-subdomain alerts, easy but lower demand), and `dns-hygiene` (SPF/DKIM/DMARC parser — trivial to add once we've validated demand).

### Legal / positioning note

We are **not offering penetration testing**. Standard ToS wording, adapted from Intruder and Detectify:

> "status.watch performs passive and low-impact active monitoring of internet-facing assets that Customer represents and warrants Customer owns or is authorized to monitor. Customer grants status.watch a limited license to send monitoring requests to those assets. No credential-brute-forcing, no exploitation payloads, no denial-of-service testing is performed. Any monitor type explicitly labeled 'active scan' (e.g. port scan) requires Customer to affirmatively opt in per asset."

Add a per-monitor "I own this asset" checkbox with IP-and-timestamp audit log for the `port-scan` and any future active-scan monitors. Follow US CFAA / EU NIS2 safe-harbor precedent — everything else in the four types above is passive HTTP client behavior, no different from a normal browser hitting the site.

### Ship order

1. `security-headers` — 2 days work, zero new infra, immediate marketing story ("free A-F grader in every plan").
2. `ssl-grade` — 1 day, one external API, complements #1.
3. `content-hash` — 1 day, unlocks defacement-detection use case.
4. `browser` — 2 weeks (Fly Machine pool, queue, script sandbox, trace viewer UI). Highest value, gate behind Pro plan at $29/mo.
