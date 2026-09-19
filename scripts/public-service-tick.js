#!/usr/bin/env node
// Local ticker for public-service monitoring — hits /api/cron/public-services
// every 30 seconds. In production, Vercel Cron (see vercel.json) fires this
// route every minute; if you need sub-minute cadence on Vercel, run this
// script from a long-lived worker (Fly, Railway, a VM, etc.) instead.
//
// Usage:
//   node scripts/public-service-tick.js
//   node scripts/public-service-tick.js --url http://localhost:3000 --interval 30

const fs = require("node:fs")
const path = require("node:path")

function readEnv() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return {}
  const out = {}
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "")
  }
  return out
}

const env = readEnv()
const args = process.argv.slice(2)
function arg(name, def) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : def
}

const url = arg("--url", process.env.APP_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
const intervalSec = Number(arg("--interval", "30"))
const secret = process.env.CRON_SECRET || env.CRON_SECRET || ""

const target = `${url.replace(/\/$/, "")}/api/cron/public-services`

async function tick() {
  const started = Date.now()
  try {
    const r = await fetch(target, {
      method: "POST",
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    })
    const body = await r.json().catch(() => ({}))
    const dur = Date.now() - started
    if (r.ok) {
      console.log(
        `[${new Date().toISOString()}] ok · checked=${body.checked ?? "?"} up=${body.up ?? "?"} down=${body.down ?? "?"} · ${dur}ms`,
      )
    } else {
      console.error(
        `[${new Date().toISOString()}] http ${r.status} · ${JSON.stringify(body).slice(0, 200)}`,
      )
    }
  } catch (e) {
    console.error(`[${new Date().toISOString()}] err · ${e?.message ?? e}`)
  }
}

console.log(`Ticking ${target} every ${intervalSec}s${secret ? " (with CRON_SECRET)" : ""}`)
tick()
setInterval(tick, intervalSec * 1000)
