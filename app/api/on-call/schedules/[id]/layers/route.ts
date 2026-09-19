import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const body = await req.json().catch(() => ({}))
  const db = getDatabase()
  const owns = db
    .prepare("SELECT id FROM on_call_schedules WHERE id = ? AND workspace_id = ?")
    .get(params.id, ws.id)
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const name = String(body.name || "Layer")
  const rotation_kind = String(body.rotation_kind || "weekly")
  const rotation_days = parseInt(String(body.rotation_days || "7"), 10)
  const handoff_time = String(body.handoff_time || "09:00")
  const members = Array.isArray(body.members) ? body.members : []
  const order = (
    db
      .prepare(
        "SELECT COALESCE(MAX(layer_order), 0) + 1 AS n FROM on_call_layers WHERE schedule_id = ?",
      )
      .get(params.id) as { n: number }
  ).n

  const id = "lyr_" + randomUUID().slice(0, 12)
  db.prepare(
    `INSERT INTO on_call_layers (id, schedule_id, name, rotation_kind, rotation_days, handoff_time, members, layer_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.id,
    name,
    rotation_kind,
    rotation_days,
    handoff_time,
    JSON.stringify(members),
    order,
  )
  return NextResponse.json({ id })
}
