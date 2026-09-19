# SDK & Agent Design for Statuswatch

Research on existing uptime, synthetic, and observability SDKs, followed by a
concrete design proposal for our platform's agent. Sources are cited inline.

---

## 1. Competitive SDK Landscape

### 1.1 Sentry (Node.js + Python)

- **Install.** `npm i @sentry/node` or `pip install "sentry-sdk[flask]"`. A
  single `Sentry.init({ dsn })` / `sentry_sdk.init(dsn=...)` call bootstraps
  everything. Node requires a dedicated `instrument.js` loaded via `--require`
  or `--import` before any app module so the SDK can monkey-patch HTTP, `fs`,
  `pg`, `mysql2`, etc.
- **Probes.** Defined in code. Sentry auto-detects installed packages and
  activates matching integrations (`DjangoIntegration`, `FlaskIntegration`,
  Express, Prisma, Redis).
- **Transport.** HTTPS POST of envelopes to the DSN ingest endpoint.
- **Auth.** DSN string embeds a public key + project ID; server-side rate
  limits enforce quotas.
- **Self-diagnosis.** Rich stack traces, breadcrumbs, and span waterfalls per
  transaction, but *no explicit layer isolation* (DNS vs. TCP vs. TLS). You see
  "the pg span errored" — you still infer the layer.

### 1.2 Datadog Synthetics

- **Install.** No SDK in the app. Tests are created in the dashboard,
  Terraform, or `datadog-ci.json`. CI runner: `npm i -D @datadog/datadog-ci`.
- **Probes.** Config-driven. A `datadog-ci.json` (or path via
  `DATADOG_SYNTHETICS_CONFIG_PATH`) points at test IDs; tests are HTTP, SSL,
  DNS, WebSocket, TCP, UDP, ICMP, gRPC, or multi-step browser.
- **Transport.** Datadog cloud probes execute; results reported over
  Datadog's private ingest.
- **Auth.** `DD_API_KEY` + `DD_APP_KEY` env vars.
- **Self-diagnosis.** Granular — each API-test level (DNS/SSL/TCP/HTTP) is
  itself a first-class check type, so failures are naturally layer-tagged.

### 1.3 Checkly (Monitoring-as-Code)

- **Install.** `npm i -D checkly` then `npx checkly login`.
- **Probes.** `checkly.config.ts` defines the project (name, logical ID,
  regions, alert channels). Individual checks are `.check.ts` files using
  `BrowserCheck`, `ApiCheck`, or `PlaywrightCheck` constructs. `npx checkly
  test` runs locally; `npx checkly deploy` pushes to the cloud.
- **Transport.** Checkly cloud runners; results in dashboard.
- **Auth.** Account + API key stored via `checkly login`.
- **Self-diagnosis.** As of early 2026, "Rocky" AI-triages failures, analyzing
  packet captures and traceroutes to surface root cause — closest match to
  what we want.

### 1.4 BetterStack (Better Uptime) Heartbeats

- **Install.** None — the "SDK" is `curl`.
- **Probes.** Dashboard creates a heartbeat and returns a URL. Append `curl
  https://uptime.betterstack.com/api/v1/heartbeat/<TOKEN>` to the end of the
  cron. Failure reported by appending `/fail` or the shell exit code
  (`/$?`), and stdout can be POSTed as body.
- **Transport.** HTTPS GET/POST.
- **Auth.** Opaque token embedded in the URL (no signing).
- **Self-diagnosis.** None — presence/absence of the ping is the only signal.

### 1.5 Cronitor / Healthchecks.io / Hyperping

- **Install.** curl-only baseline, plus optional `cronitor` Python/Node
  packages that wrap `check-in`.
- **Probes.** Dashboard-defined intervals + grace windows. Ping URLs support
  `/start`, `/complete`, `/fail`, so Cronitor knows duration and success
  separately.
- **Transport.** HTTPS ping.
- **Auth.** Token-in-URL.
- **Self-diagnosis.** None beyond duration anomaly detection.

### 1.6 Uptime Kuma (open-source)

- **Install.** Self-hosted Docker; no in-app SDK.
- **Probes.** Dashboard-defined: HTTP(S), TCP, ping (ICMP), DNS, WebSocket
  upgrade, SNMP, Docker, Steam game server. Each has `interval`, `retries`,
  `timeout`, and an "Upside Down Mode" for expected downtime.
- **Transport.** Kuma server actively polls targets; also exposes push URLs.
- **Auth.** Local username/password; push tokens for pushed monitors.
- **Self-diagnosis.** None — you get per-monitor-type status, but there is no
  layered waterfall.

### 1.7 OpenTelemetry

- **Install.** `npm i @opentelemetry/api @opentelemetry/sdk-node
  @opentelemetry/auto-instrumentations-node`, then run
  `node --require ./instrumentation.js server.js`.
- **Probes.** Meta-package `auto-instrumentations-node` monkey-patches dozens
  of libraries. Same load-order caveat as Sentry.
- **Transport.** OTLP over gRPC or HTTPS to a collector.
- **Auth.** Headers/env vars per exporter.
- **Self-diagnosis.** Spans capture per-dependency latency, but the *diagnosis*
  is left to the backend.

### Cross-cutting observations

1. **Two clear archetypes** exist: (a) in-process SDKs that instrument the app
   (Sentry, OTel) and (b) external probers configured via dashboard/config
   (Datadog Synthetics, Checkly, Kuma, BetterStack).
2. Every heartbeat product converges on the same **token-in-URL** pattern.
3. Only Checkly (Rocky) and Datadog's layered API-test types come close to
   answering *where* a failure lives — a real gap in the market.

---

## 2. Recommended Statuswatch SDK Design

### 2.1 Package name

- npm: `@statuswatch/agent`
- PyPI: `statuswatch-agent`
- Deno / Bun: `jsr:@statuswatch/agent`
- Go (future): `github.com/statuswatch/agent-go`

### 2.2 Install + minimal init

**Node.js**
```bash
npm i @statuswatch/agent
```
```js
// instrument.js — loaded via `node --import ./instrument.js server.js`
import { Statuswatch } from "@statuswatch/agent";
Statuswatch.init({ token: process.env.STATUSWATCH_TOKEN, service: "api" });
```

**Python**
```bash
pip install statuswatch-agent
```
```python
import statuswatch
statuswatch.init(token=os.environ["STATUSWATCH_TOKEN"], service="api")
```

**Deno / Bun**
```ts
import { Statuswatch } from "jsr:@statuswatch/agent";
Statuswatch.init({ token: Deno.env.get("STATUSWATCH_TOKEN") });
```

### 2.3 Config model — hybrid

Follow Checkly's monitoring-as-code but keep dashboard-defined checks as a
first-class citizen for non-technical users.

- `statuswatch.config.ts` (optional) declares checks, heartbeats, and alert
  channels; `npx statuswatch deploy` reconciles them with the dashboard using
  a `logicalId`, matching Checkly's model.
- Dashboard-only users can define the same checks in a UI; both write to the
  same backing store.
- Server precedence: dashboard changes are flagged as "drift" on next deploy
  so ops teams see them.

### 2.4 How the agent probes

Two runtimes:

1. **Inline middleware** for framework health (Express, Fastify, FastAPI,
   Django). Wraps handlers to capture per-route latency, error rate, and
   dependency spans (DB, upstream HTTP). Reports every N seconds as
   aggregated telemetry — never blocks the request.
2. **Background worker** in a dedicated thread (Node worker_thread / Python
   asyncio task) that executes user-defined synthetic checks locally and
   sends heartbeats. This is what makes us different from cloud-only probers:
   we can synth-check *from inside* the customer's VPC.

Both paths push to `https://ingest.statuswatch.io/v1/events` over HTTPS with
gzip + protobuf; fall back to JSON. Batched every 5s or 100 events.

### 2.5 Self-diagnosis — the diagnostic waterfall

On any check failure, the agent runs an ordered probe cascade and tags the
event with the *first* layer that failed. Each layer is fast (<200ms budget)
so total overhead is bounded.

| # | Layer            | Probe                                          | Signal reported                   |
|---|------------------|------------------------------------------------|-----------------------------------|
| 1 | DNS              | `dns.lookup(host)`                             | `failure.layer=dns`               |
| 2 | TCP connect      | Raw socket to `host:port` w/ 500ms timeout     | `failure.layer=tcp`               |
| 3 | TLS handshake    | Complete handshake, capture cert chain         | `failure.layer=tls` + cert expiry |
| 4 | HTTP HEAD        | HEAD `/` — is *any* HTTP response returned?    | `failure.layer=http_server`       |
| 5 | HTTP target      | GET the actual URL under test                  | `failure.layer=http_route`        |
| 6 | Dependency ping  | Registered DB/queue/upstream ping handlers     | `failure.layer=db|queue|upstream` |
| 7 | Local runtime    | Event-loop lag, GC pauses, memory              | `failure.layer=self`              |

Users register dependency probes at init:
```js
Statuswatch.registerDependency("primary-db", async () => {
  await db.query("SELECT 1");
});
```
The waterfall short-circuits on first failure and the platform renders
"Failure isolated to: **TLS** (cert expired 2h ago)" instead of a generic
timeout. This is the marquee feature.

### 2.6 Heartbeat design

- Dashboard: user creates a heartbeat monitor with expected interval + grace.
- Backend returns `https://api.statuswatch.io/hb/<token>` (BetterStack-style
  token-in-URL — no signing needed for a low-value write endpoint, but
  rate-limited per token).
- Three usage patterns:
  1. **curl** (works everywhere): `curl -fsS https://api.statuswatch.io/hb/<token>`
  2. **SDK helper**:
     ```js
     await Statuswatch.heartbeat("<token>").checkin();
     ```
  3. **Wrapped job** (matches Cronitor's `/start` `/complete`):
     ```js
     await Statuswatch.job("<token>").run(async () => {
       await runBackup();
     });
     ```
     Wraps in try/finally, pings `/start`, `/ok` (with duration), or
     `/fail` (with exit code + stderr tail).
- Append `/fail` or `/{exitCode}` for shell-native error reporting to keep
  parity with BetterStack and Cronitor.

### 2.7 Auth model

- **Project token** (BetterStack + Sentry hybrid): opaque string embedded in
  init call and heartbeat URLs. Cheap to rotate, scoped to a project.
- OAuth for the dashboard + Terraform provider.
- Server-side ingest verifies token, matches project, then throttles.

### 2.8 First three SDK targets to ship (ranked)

1. **Node.js** — largest install base for the "install SDK in my web app"
   persona; JS/TS is Checkly and Sentry's biggest surface for a reason.
2. **curl-only heartbeat** — zero install, works from any cron / GitHub
   Action / Kubernetes CronJob; unlocks the full BetterStack/Cronitor use
   case immediately.
3. **Python** — data pipelines, ML jobs, Django apps; heartbeats especially
   land well here (nightly ETL is the archetypal "silent failure").

Deferred: browser JS (v2, needs sampling + CORS story), Go (v2, for infra
tools), Ruby (v3, smaller demand curve).

---

## Sources

- [Sentry Node.js — Automatic Instrumentation](https://docs.sentry.io/platforms/node/performance/instrumentation/automatic-instrumentation/)
- [`@sentry/node` on npm](https://www.npmjs.com/package/@sentry/node)
- [Sentry Python SDK on PyPI](https://pypi.org/project/sentry-sdk/)
- [Sentry Python integrations](https://docs.sentry.io/platforms/python/integrations/)
- [Datadog Synthetic Testing docs](https://docs.datadoghq.com/synthetics/)
- [Datadog Synthetics API tests](https://docs.datadoghq.com/synthetics/api_tests/)
- [`datadog-ci` synthetics plugin](https://github.com/DataDog/datadog-ci/tree/master/packages/plugin-synthetics)
- [Checkly Monitoring as Code](https://www.checklyhq.com/product/monitoring-as-code/)
- [Checkly CLI overview](https://www.checklyhq.com/docs/cli/overview/)
- [Checkly Playwright Check Suites](https://www.checklyhq.com/docs/playwright-checks/)
- [`checkly` on npm](https://www.npmjs.com/package/checkly)
- [BetterStack Cron and heartbeat monitor](https://betterstack.com/docs/uptime/cron-and-heartbeat-monitor/)
- [BetterStack — What is cron monitoring](https://betterstack.com/community/guides/monitoring/what-is-cron-monitoring/)
- [Cronitor vs. Dead Man's Snitch](https://cronitor.io/versus-dead-mans-snitch)
- [Healthchecks.io docs](https://healthchecks.io/docs/)
- [Uptime Kuma monitor types (DeepWiki)](https://deepwiki.com/louislam/uptime-kuma/3.1-monitor-types)
- [OpenTelemetry JS zero-code instrumentation](https://opentelemetry.io/docs/zero-code/js/)
- [`@opentelemetry/auto-instrumentations-node` on npm](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node)
