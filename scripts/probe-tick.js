#!/usr/bin/env node
// Local cron ticker — hits /api/cron/probe every 30 seconds.
// In production, Vercel Cron (see vercel.json) does this automatically.
//
// Usage:
//   node scripts/probe-tick.js
//   node scripts/probe-tick.js --url http://localhost:3000 --interval 30
//
// If CRON_SECRET is set in your .env.local, this script reads it and sends
// it as a Bearer token. Otherwise it relies on the local-loopback bypass.

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
const URL_BASE = arg("--url", env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
const INTERVAL_S = parseInt(arg("--interval", "30"), 10)
const SECRET = env.CRON_SECRET

async function tick() {
  const started = Date.now()
  try {
    const res = await fetch(`${URL_BASE}/api/cron/probe`, {
      headers: SECRET ? { Authorization: `Bearer ${SECRET}` } : {},
    })
    const body = await res.text()
    const dur = Date.now() - started
    if (res.ok) {
      let checked = "?"
      try {
        checked = JSON.parse(body).checked ?? "?"
      } catch {}
      console.log(
        `[${new Date().toISOString()}] tick — checked ${checked} monitors in ${dur}ms`,
      )
    } else {
      console.error(`[${new Date().toISOString()}] tick failed: ${res.status} ${body.slice(0, 200)}`)
    }
  } catch (e) {
    console.error(`[${new Date().toISOString()}] tick error:`, e.message)
  }
}

console.log(
  `status.watch probe ticker\n  URL:      ${URL_BASE}/api/cron/probe\n  Interval: ${INTERVAL_S}s\n  Secret:   ${SECRET ? "set" : "not set (localhost-only)"}\n`,
)
tick()
setInterval(tick, INTERVAL_S * 1000)
