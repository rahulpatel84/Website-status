import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function PATCH(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  if (ws.role !== "owner" && ws.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: "Name must be 1-80 characters" }, { status: 400 })
  }

  const db = getDatabase()
  db.prepare("UPDATE workspaces SET name = ? WHERE id = ?").run(name, ws.id)
  return NextResponse.json({ ok: true, workspace: { ...ws, name } })
}
