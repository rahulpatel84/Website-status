import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

const VALID_KINDS = new Set(["email", "telegram", "slack", "webhook"])

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  const rows = db
    .prepare(
      "SELECT id, kind, label, config, is_verified, created_at FROM notification_channels WHERE workspace_id = ? ORDER BY created_at DESC",
    )
    .all(ws.id)
  return NextResponse.json({ channels: rows })
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const body = await request.json().catch(() => ({}))
  const { kind, label, config } = body
  if (!VALID_KINDS.has(kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 })
  if (!label || typeof label !== "string")
    return NextResponse.json({ error: "Label required" }, { status: 400 })
  const id = "ch_" + randomUUID().slice(0, 12)
  const db = getDatabase()
  db.prepare(
    "INSERT INTO notification_channels (id, workspace_id, kind, label, config, is_verified) VALUES (?, ?, ?, ?, ?, 0)",
  ).run(id, ws.id, kind, label, JSON.stringify(config ?? {}))
  return NextResponse.json({ channel: { id, workspace_id: ws.id, kind, label, config, is_verified: 0 } })
}
