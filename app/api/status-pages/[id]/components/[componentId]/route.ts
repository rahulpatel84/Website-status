import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function DELETE(
  _r: Request,
  { params }: { params: { id: string; componentId: string } },
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  const owns = db
    .prepare("SELECT id FROM status_pages WHERE id = ? AND workspace_id = ?")
    .get(params.id, ws.id)
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 })
  db.prepare("DELETE FROM status_page_components WHERE id = ? AND page_id = ?").run(
    params.componentId,
    params.id,
  )
  return NextResponse.json({ ok: true })
}
