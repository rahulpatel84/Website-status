// Telegram transport + pairing helpers.

import { randomUUID } from "node:crypto"
import { getDatabase } from "@/lib/database"
import { logEvent } from "@/lib/logs"

export interface TelegramButton {
  text: string
  callback_data: string
  url?: string
}

export interface SendTelegramArgs {
  chatId: string | number
  text: string
  buttons?: TelegramButton[] | TelegramButton[][]
  parseMode?: "Markdown" | "MarkdownV2" | "HTML"
}

export interface SendTelegramResult {
  ok: boolean
  mocked?: boolean
  error?: string
  messageId?: number
}

const API_BASE = "https://api.telegram.org"

// A chat_id is the channel's routing secret. Only a short suffix is logged so
// operators can correlate rows without the log leaking a usable destination.
function maskChatId(chatId: string | number): string {
  const raw = String(chatId)
  return raw.length <= 4 ? "***" : `***${raw.slice(-4)}`
}

function normalizeButtons(
  buttons?: TelegramButton[] | TelegramButton[][],
): TelegramButton[][] | undefined {
  if (!buttons || buttons.length === 0) return undefined
  const first = buttons[0]
  if (Array.isArray(first)) return buttons as TelegramButton[][]
  return [buttons as TelegramButton[]]
}

export async function sendTelegramMessage({
  chatId,
  text,
  buttons,
  parseMode,
}: SendTelegramArgs): Promise<SendTelegramResult> {
  if (!chatId) return { ok: false, error: "chatId required" }
  if (!text) return { ok: false, error: "text required" }

  const token = process.env.TELEGRAM_BOT_TOKEN
  const keyboard = normalizeButtons(buttons)
  const reply_markup = keyboard ? { inline_keyboard: keyboard } : undefined

  if (!token) {
    console.log("[telegram:mock]", { chatId, text, reply_markup })
    logEvent({
      level: "info",
      source: "notification",
      event: "notification.telegram_sent",
      message: `Telegram message to ${maskChatId(chatId)} mocked (TELEGRAM_BOT_TOKEN unset)`,
      targetType: "telegram_chat",
      targetId: maskChatId(chatId),
      metadata: {
        mocked: true,
        textLength: text.length,
        buttonRows: keyboard?.length ?? 0,
      },
    })
    return { ok: true, mocked: true }
  }

  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        reply_markup,
      }),
    })
    const body = (await res.json()) as {
      ok: boolean
      description?: string
      result?: { message_id?: number }
    }
    if (!body.ok) {
      const error = body.description || `HTTP ${res.status}`
      logEvent({
        level: "error",
        source: "notification",
        event: "notification.telegram_failed",
        message: `Telegram message to ${maskChatId(chatId)} rejected: ${error}`,
        targetType: "telegram_chat",
        targetId: maskChatId(chatId),
        metadata: { error, httpStatus: res.status, textLength: text.length },
      })
      return { ok: false, error }
    }
    logEvent({
      level: "info",
      source: "notification",
      event: "notification.telegram_sent",
      message: `Telegram message delivered to ${maskChatId(chatId)}`,
      targetType: "telegram_chat",
      targetId: maskChatId(chatId),
      metadata: {
        messageId: body.result?.message_id,
        textLength: text.length,
        buttonRows: keyboard?.length ?? 0,
      },
    })
    return { ok: true, messageId: body.result?.message_id }
  } catch (err) {
    const message = err instanceof Error ? err.message : "telegram send failed"
    logEvent({
      level: "error",
      source: "notification",
      event: "notification.telegram_failed",
      message: `Telegram message to ${maskChatId(chatId)} failed: ${message}`,
      targetType: "telegram_chat",
      targetId: maskChatId(chatId),
      metadata: { error: message, textLength: text.length },
    })
    return { ok: false, error: message }
  }
}

// -------- Pairing --------

const PAIRING_TTL_MS = 10 * 60 * 1000
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no confusing chars

function newPairingCode(): string {
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}

export async function generatePairingCode(
  workspaceId: string,
  userId: string,
): Promise<string> {
  if (!workspaceId || !userId) throw new Error("workspaceId and userId required")
  const db = getDatabase()

  // Purge any expired unused codes for this user before issuing a new one.
  db.prepare(
    `DELETE FROM telegram_pairings
     WHERE workspace_id = ? AND user_id = ? AND used_at IS NULL`,
  ).run(workspaceId, userId)

  // Retry a handful of times in case of collision on the primary key.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newPairingCode()
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString()
    try {
      db.prepare(
        `INSERT INTO telegram_pairings (code, workspace_id, user_id, expires_at)
         VALUES (?, ?, ?, ?)`,
      ).run(code, workspaceId, userId, expiresAt)
      return code
    } catch {
      // collision — retry
    }
  }
  throw new Error("Failed to generate pairing code")
}

export interface CompletePairingResult {
  ok: boolean
  channelId?: string
  error?: string
}

export async function completePairing(
  code: string,
  chatId: string,
): Promise<CompletePairingResult> {
  if (!code || !chatId) return { ok: false, error: "code and chatId required" }
  const normalized = code.trim().toUpperCase().replace(/[-\s]/g, "")
  const db = getDatabase()

  const row = db
    .prepare(
      `SELECT code, workspace_id, user_id, expires_at, used_at
       FROM telegram_pairings WHERE code = ?`,
    )
    .get(normalized) as
    | {
        code: string
        workspace_id: string
        user_id: string
        expires_at: string
        used_at: string | null
      }
    | undefined

  if (!row) return { ok: false, error: "invalid code" }
  if (row.used_at) return { ok: false, error: "code already used" }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "code expired" }
  }

  const channelId = "ch_" + randomUUID().slice(0, 12)
  const config = JSON.stringify({ chat_id: chatId })

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO notification_channels
         (id, workspace_id, kind, label, config, is_verified)
       VALUES (?, ?, 'telegram', ?, ?, 1)`,
    ).run(channelId, row.workspace_id, `Telegram (${chatId})`, config)

    db.prepare(
      `UPDATE telegram_pairings
         SET used_at = CURRENT_TIMESTAMP, chat_id = ?
       WHERE code = ?`,
    ).run(chatId, normalized)
  })

  tx()

  return { ok: true, channelId }
}
