import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function GET(_r: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  const page = db
    .prepare("SELECT * FROM status_pages WHERE id = ? AND workspace_id = ?")
    .get(params.id, ws.id)
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const components = db
    .prepare(
      "SELECT spc.*, m.name AS monitor_name, m.target AS monitor_target, m.current_status FROM status_page_components spc JOIN monitors m ON m.id = spc.monitor_id WHERE spc.page_id = ? ORDER BY spc.sort_order",
    )
    .all(params.id)
  return NextResponse.json({ page, components })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const body = await request.json().catch(() => ({}))
  const db = getDatabase()
  const owned = db.prepare("SELECT id FROM status_pages WHERE id = ? AND workspace_id = ?").get(params.id, ws.id)
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const fields: string[] = []
  const values: any[] = []
  for (const k of ["name", "accent_color", "visibility", "custom_domain", "logo_url"]) {
    if (typeof body[k] === "string") {
      fields.push(`${k} = ?`)
      values.push(body[k])
    }
  }
  if (fields.length) {
    values.push(params.id)
    db.prepare(`UPDATE status_pages SET ${fields.join(", ")} WHERE id = ?`).run(...values)
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_r: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  db.prepare("DELETE FROM status_pages WHERE id = ? AND workspace_id = ?").run(params.id, ws.id)
  return NextResponse.json({ ok: true })
}
