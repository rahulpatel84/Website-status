import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  const schedules = db
    .prepare(
      `SELECT s.id, s.name, s.timezone, s.created_at,
              (SELECT COUNT(*) FROM on_call_layers WHERE schedule_id = s.id) AS layer_count
       FROM on_call_schedules s
       WHERE s.workspace_id = ?
       ORDER BY s.created_at DESC`,
    )
    .all(ws.id)
  return NextResponse.json({ schedules })
}

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const body = await req.json().catch(() => ({}))
  const name = String(body.name || "").trim() || "Primary rotation"
  const timezone = String(body.timezone || "UTC")
  const id = "sch_" + randomUUID().slice(0, 12)
  const db = getDatabase()
  db.prepare(
    "INSERT INTO on_call_schedules (id, workspace_id, name, timezone, created_by) VALUES (?, ?, ?, ?, ?)",
  ).run(id, ws.id, name, timezone, user.id)
  return NextResponse.json({ id, name, timezone })
}
