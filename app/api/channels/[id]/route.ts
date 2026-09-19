import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  db.prepare(
    "DELETE FROM notification_channels WHERE id = ? AND workspace_id = ?",
  ).run(params.id, ws.id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const body = await request.json().catch(() => ({}))
  const db = getDatabase()
  const row = db
    .prepare("SELECT id, config FROM notification_channels WHERE id = ? AND workspace_id = ?")
    .get(params.id, ws.id) as { id: string; config: string } | undefined
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const label = typeof body.label === "string" ? body.label : null
  if (label != null) {
    db.prepare("UPDATE notification_channels SET label = ? WHERE id = ?").run(label, params.id)
  }

  // `config` replaces the whole blob; `configPatch` shallow-merges into the
  // existing one (used by small UI edits like the renotify-cadence dropdown).
  if (body.config != null) {
    db.prepare("UPDATE notification_channels SET config = ? WHERE id = ?").run(
      JSON.stringify(body.config),
      params.id,
    )
  } else if (body.configPatch != null && typeof body.configPatch === "object") {
    let current: Record<string, unknown> = {}
    try {
      current = JSON.parse(row.config)
    } catch {}
    const merged = { ...current, ...body.configPatch }
    db.prepare("UPDATE notification_channels SET config = ? WHERE id = ?").run(
      JSON.stringify(merged),
      params.id,
    )
  }
  return NextResponse.json({ ok: true })
}
