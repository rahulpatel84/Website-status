import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const body = await request.json().catch(() => ({}))
  const monitor_id = String(body.monitor_id || "")
  const group_name = String(body.group_name || "Services")
  const display_name = body.display_name ? String(body.display_name) : null

  const db = getDatabase()
  const owns = db
    .prepare(
      "SELECT sp.id FROM status_pages sp JOIN monitors m ON m.workspace_id = sp.workspace_id WHERE sp.id = ? AND m.id = ? AND sp.workspace_id = ?",
    )
    .get(params.id, monitor_id, ws.id)
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const id = "spc_" + randomUUID().slice(0, 12)
  const nextOrder = (db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM status_page_components WHERE page_id = ?")
    .get(params.id) as { n: number }).n
  db.prepare(
    "INSERT INTO status_page_components (id, page_id, monitor_id, group_name, display_name, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, params.id, monitor_id, group_name, display_name, nextOrder)
  return NextResponse.json({ ok: true, id })
}
