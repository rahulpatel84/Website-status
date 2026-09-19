import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { getDatabase } from "@/lib/database"

// Minimal webhook receiver for @statuswatch_bot.
// If a message body matches an unused pairing code, create a notification channel.
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: "webhook-not-configured" }, { status: 503 })
  }
  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const update = await request.json().catch(() => ({}))
  const token = process.env.TELEGRAM_BOT_TOKEN

  const msg = update?.message
  if (!msg || !token) return NextResponse.json({ ok: true })

  const chatId = String(msg.chat?.id ?? "")
  const text = String(msg.text ?? "").trim()
  if (!chatId) return NextResponse.json({ ok: true })

  const db = getDatabase()

  // /start — greet
  if (text.toLowerCase() === "/start") {
    await sendMessage(token, chatId, "Hi! Paste your pairing code from status.watch to link this chat.")
    return NextResponse.json({ ok: true })
  }

  // Try as pairing code
  const codeMatch = text.toUpperCase().replace(/\s+/g, "")
  const row = db
    .prepare(
      "SELECT code, workspace_id FROM telegram_pairings WHERE code = ? AND used_at IS NULL AND expires_at > datetime('now')",
    )
    .get(codeMatch) as { code: string; workspace_id: string } | undefined

  if (row) {
    db.prepare(
      "UPDATE telegram_pairings SET used_at = CURRENT_TIMESTAMP, chat_id = ? WHERE code = ?",
    ).run(chatId, row.code)
    const chId = "ch_" + randomUUID().slice(0, 12)
    db.prepare(
      "INSERT INTO notification_channels (id, workspace_id, kind, label, config, is_verified) VALUES (?, ?, 'telegram', ?, ?, 1)",
    ).run(
      chId,
      row.workspace_id,
      `chat ${chatId}`,
      JSON.stringify({ chat_id: chatId }),
    )
    await sendMessage(token, chatId, "Linked — you'll receive alerts here.")
    return NextResponse.json({ ok: true, linked: true })
  }

  await sendMessage(
    token,
    chatId,
    "That doesn't look like a valid pairing code. Grab a fresh one from status.watch → Notifications → Telegram.",
  )
  return NextResponse.json({ ok: true })
}

async function sendMessage(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {})
}
