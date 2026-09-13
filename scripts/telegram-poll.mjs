#!/usr/bin/env node
// Local Telegram poller. Calls getUpdates on Telegram's API and forwards each
// update to the app's own webhook, authenticated with TELEGRAM_WEBHOOK_SECRET.
// Use this in development so Telegram doesn't need to reach your localhost.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv(path) {
  try {
    const raw = readFileSync(path, "utf8")
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      let value = m[2]
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {}
}

loadEnv(resolve(__dirname, "..", ".env.local"))

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .env.local")
  process.exit(1)
}
if (!SECRET) {
  console.error("Missing TELEGRAM_WEBHOOK_SECRET in .env.local")
  process.exit(1)
}

const WEBHOOK_URL = `${APP_URL.replace(/\/$/, "")}/api/telegram/webhook`
const API = `https://api.telegram.org/bot${TOKEN}`

// If a webhook is currently registered, Telegram refuses getUpdates.
async function ensurePollingMode() {
  const r = await fetch(`${API}/getWebhookInfo`).then((x) => x.json())
  if (r?.result?.url) {
    console.log(`Deleting existing webhook (${r.result.url}) to enable polling…`)
    await fetch(`${API}/deleteWebhook`)
  }
}

async function forward(update) {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": SECRET,
      },
      body: JSON.stringify(update),
    })
    if (!res.ok) {
      console.error(`Webhook responded ${res.status}: ${await res.text()}`)
    }
  } catch (err) {
    console.error("Failed to forward update:", err.message)
  }
}

async function poll() {
  await ensurePollingMode()
  console.log(`Polling Telegram → ${WEBHOOK_URL}`)
  let offset = 0
  while (true) {
    try {
      const res = await fetch(
        `${API}/getUpdates?timeout=25&offset=${offset}`,
      ).then((r) => r.json())
      if (res?.ok && Array.isArray(res.result)) {
        for (const upd of res.result) {
          offset = upd.update_id + 1
          await forward(upd)
        }
      } else if (res && !res.ok) {
        console.error("Telegram error:", res.description)
        await new Promise((r) => setTimeout(r, 5000))
      }
    } catch (err) {
      console.error("Poll error:", err.message)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

poll()
