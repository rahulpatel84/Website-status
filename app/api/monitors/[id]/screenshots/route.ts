import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function GET(_r: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()

  const owns = db
    .prepare("SELECT id FROM monitors WHERE id = ? AND workspace_id = ?")
    .get(params.id, ws.id)
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const rows = db
    .prepare(
      `SELECT id, path, size_bytes, taken_at, expires_at
       FROM probe_screenshots
       WHERE monitor_id = ?
       ORDER BY taken_at DESC`,
    )
    .all(params.id)
  const totalBytes = (
    db
      .prepare(
        "SELECT COALESCE(SUM(size_bytes), 0) AS s FROM probe_screenshots WHERE monitor_id = ?",
      )
      .get(params.id) as { s: number }
  ).s
  return NextResponse.json({ shots: rows, count: rows.length, total_bytes: totalBytes })
}
