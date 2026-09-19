import { NextResponse } from "next/server"
import { randomUUID, randomBytes, createHash } from "node:crypto"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  const keys = db
    .prepare(
      "SELECT id, label, prefix, last_used_at, created_at FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC",
    )
    .all(ws.id)
  return NextResponse.json({ keys })
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const body = await request.json().catch(() => ({}))
  const label = String(body.label || "").trim() || "default"

  const raw = "sw_prj_" + randomBytes(18).toString("hex")
  const prefix = raw.slice(0, 12)
  const hashed = createHash("sha256").update(raw).digest("hex")

  const id = "key_" + randomUUID().slice(0, 12)
  const db = getDatabase()
  db.prepare(
    "INSERT INTO api_keys (id, workspace_id, label, prefix, hashed_token, created_by) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, ws.id, label, prefix, hashed, user.id)

  return NextResponse.json({ id, label, prefix, token: raw })
}
