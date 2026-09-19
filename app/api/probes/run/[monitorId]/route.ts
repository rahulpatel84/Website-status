import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { runMonitor } from "@/lib/monitor-engine/runner"

export async function POST(
  _request: Request,
  { params }: { params: { monitorId: string } },
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)

  const db = getDatabase()
  const row = db
    .prepare("SELECT id FROM monitors WHERE id = ? AND workspace_id = ?")
    .get(params.monitorId, ws.id)
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const result = await runMonitor(params.monitorId)
  return NextResponse.json({ ok: true, result })
}
