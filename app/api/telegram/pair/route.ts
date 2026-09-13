import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

function code(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(4)
  let out = ""
  for (let i = 0; i < 4; i++) out += chars[bytes[i] % chars.length]
  out += "-"
  const bytes2 = randomBytes(4)
  for (let i = 0; i < 4; i++) out += chars[bytes2[i] % chars.length]
  return out
}

export async function POST() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const c = code()
  db.prepare(
    "INSERT INTO telegram_pairings (code, workspace_id, user_id, expires_at) VALUES (?, ?, ?, ?)",
  ).run(c, ws.id, user.id, expiresAt)

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "statuswatch_bot"
  return NextResponse.json({ code: c, expiresAt, botUsername })
}
