import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { dispatchIncidentByMonitor } from "@/lib/notifications/dispatch"

interface MonitorRow {
  id: string
  workspace_id: string
  current_status: string
}

interface IncidentRow {
  id: string
  started_at: string
  resolved_at: string | null
}

/**
 * Force-fires the currently-ongoing incident's notification. Useful when the
 * monitor was already down before you attached channels — the regular
 * dispatcher only fires on state transitions, so there's nothing to catch
 * up a stale incident otherwise.
 */
export async function POST(
  _r: Request,
  { params }: { params: { id: string } },
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()

  const monitor = db
    .prepare(
      "SELECT id, workspace_id, current_status FROM monitors WHERE id = ? AND workspace_id = ?",
    )
    .get(params.id, ws.id) as MonitorRow | undefined
  if (!monitor) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const incident = db
    .prepare(
      "SELECT id, started_at, resolved_at FROM incidents WHERE monitor_id = ? AND resolved_at IS NULL ORDER BY started_at DESC LIMIT 1",
    )
    .get(monitor.id) as IncidentRow | undefined

  if (!incident) {
    return NextResponse.json({
      ok: false,
      error: "No ongoing incident to notify about.",
      current_status: monitor.current_status,
    })
  }

  const result = await dispatchIncidentByMonitor(monitor.id)
  return NextResponse.json({
    ok: true,
    channel_count: result?.channel_count ?? 0,
    incident_id: incident.id,
    incident_started_at: incident.started_at,
  })
}
