import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function DELETE(
  _r: Request,
  { params }: { params: { id: string } },
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  db.prepare("DELETE FROM api_keys WHERE id = ? AND workspace_id = ?").run(params.id, ws.id)
  return NextResponse.json({ ok: true })
}
