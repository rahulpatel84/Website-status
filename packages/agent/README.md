# @statuswatch/agent

Uptime monitoring SDK for [status.watch](https://status.watch) — install once,
know exactly **which layer failed** when your app breaks.

## Install

```
npm install @statuswatch/agent
```

## Quick start

```ts
import { Statuswatch } from "@statuswatch/agent"

const sw = Statuswatch.init({
  project: "acme-prod",
  token:   process.env.STATUSWATCH_TOKEN,
  endpoint: "https://status.watch",
  dependencies: {
    postgres: () => db.raw("select 1"),
    stripe:   () => fetch("https://api.stripe.com/v1/ping"),
    redis:    () => redis.ping(),
  },
})

// Health route — return 200/503 based on a live diagnostic waterfall
app.get("/health", sw.expressHealth())
```

Point a status.watch **URL monitor** at `/health`. When it fails, we display
the exact layer (DNS / TCP / TLS / HTTP / DB / dependency / runtime) that broke.

## Cron heartbeats

```ts
const job = Statuswatch.job("nightly-backup")
await job.run(async () => {
  await backupToS3()
})
```

If `nightly-backup` doesn't check in on schedule, status.watch alerts you.

## Manual diagnostic

```ts
const report = await sw.diagnose()
console.log(report.layerFailed) // "dependency" | "runtime" | undefined
```

## Curl heartbeat (no SDK)

At the end of any cron / script:

```sh
curl -fsS -m 10 --retry 3 "https://status.watch/api/heartbeat/<monitor_id>"
```

## License

MIT
