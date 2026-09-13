import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function GET(_r: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  const s = db
    .prepare("SELECT * FROM on_call_schedules WHERE id = ? AND workspace_id = ?")
    .get(params.id, ws.id)
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const layers = db
    .prepare("SELECT * FROM on_call_layers WHERE schedule_id = ? ORDER BY layer_order")
    .all(params.id)
  const overrides = db
    .prepare(
      "SELECT * FROM on_call_overrides WHERE schedule_id = ? AND end_at >= datetime('now') ORDER BY start_at",
    )
    .all(params.id)
  return NextResponse.json({ schedule: s, layers, overrides })
}

export async function DELETE(_r: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  db.prepare("DELETE FROM on_call_schedules WHERE id = ? AND workspace_id = ?").run(params.id, ws.id)
  return NextResponse.json({ ok: true })
}
