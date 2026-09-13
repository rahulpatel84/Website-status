import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { logger, createRequestId } from "@/lib/logger"
import { recordActivity } from "@/lib/activity-log"
import { logEvent } from "@/lib/logs"

interface MonitorRow {
  id: string
  workspace_id: string
  name: string
  type: string
  target: string
  method: string
  interval_s: number
  regions: string
  config: string
  is_paused: number
  current_status: string
  last_check_at: string | null
  last_response_ms: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

async function loadMonitorForWorkspace(id: string, workspaceId: string) {
  const db = getDatabase()
  const monitor = db
    .prepare(`SELECT * FROM monitors WHERE id = ? AND workspace_id = ?`)
    .get(id, workspaceId) as MonitorRow | undefined
  return monitor ?? null
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)

  const monitor = await loadMonitorForWorkspace(params.id, ws.id)
  if (!monitor) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const db = getDatabase()
  const probes = db
    .prepare(
      `SELECT id, monitor_id, region, status, response_ms, http_status, layer_failed, error, details, ran_at
       FROM probes WHERE monitor_id = ? ORDER BY ran_at DESC LIMIT 100`,
    )
    .all(monitor.id)
  const assertions = db
    .prepare(
      `SELECT id, monitor_id, kind, op, value, created_at FROM assertions WHERE monitor_id = ? ORDER BY created_at ASC`,
    )
    .all(monitor.id)

  return NextResponse.json({ monitor, probes, assertions })
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const requestId = createRequestId()
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)

  const monitor = await loadMonitorForWorkspace(params.id, ws.id)
  if (!monitor) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const updates: string[] = []
  const values: unknown[] = []
  // Captured for logging only — mirrors the is_paused value written below.
  let pausedNext: number | null = null

  if (typeof body.name === "string" && body.name.trim()) {
    updates.push("name = ?")
    values.push(body.name.trim())
  }
  if (typeof body.target === "string" && body.target.trim()) {
    updates.push("target = ?")
    values.push(body.target.trim())
  }
  if (typeof body.is_paused === "boolean" || typeof body.is_paused === "number") {
    updates.push("is_paused = ?")
    values.push(body.is_paused ? 1 : 0)
    pausedNext = body.is_paused ? 1 : 0
  }
  if (Number.isFinite(Number(body.interval_s))) {
    updates.push("interval_s = ?")
    values.push(Math.max(10, Math.min(86400, Number(body.interval_s))))
  }
  if (Array.isArray(body.regions)) {
    updates.push("regions = ?")
    values.push(JSON.stringify(body.regions.map((r) => String(r))))
  }
  if (body.config && typeof body.config === "object" && !Array.isArray(body.config)) {
    updates.push("config = ?")
    values.push(JSON.stringify(body.config))
  }

  if (updates.length === 0) {
    return NextResponse.json({ monitor })
  }

  // Field names touched by this request (used for instrumentation only).
  const changedFields = updates.map((u) => u.split(" ")[0])
  const pausedBefore = monitor.is_paused ? 1 : 0
  const pausedAfter = changedFields.includes("is_paused")
    ? body.is_paused
      ? 1
      : 0
    : pausedBefore

  updates.push("updated_at = ?")
  values.push(new Date().toISOString())

  const db = getDatabase()
  db.prepare(
    `UPDATE monitors SET ${updates.join(", ")} WHERE id = ? AND workspace_id = ?`,
  ).run(...values, monitor.id, ws.id)

  const updated = db
    .prepare(`SELECT * FROM monitors WHERE id = ?`)
    .get(monitor.id)

  logEvent({
    workspaceId: ws.id,
    actorId: user.id,
    actorLabel: user.name,
    level: "info",
    source: "monitor",
    event: "monitor.updated",
    message: `Monitor "${monitor.name}" updated`,
    targetType: "monitor",
    targetId: monitor.id,
    metadata: { changedFields },
  })

  if (typeof pausedNext === "number" && pausedNext !== monitor.is_paused) {
    logEvent({
      workspaceId: ws.id,
      actorId: user.id,
      actorLabel: user.name,
      level: "info",
      source: "monitor",
      event: pausedNext === 1 ? "monitor.paused" : "monitor.resumed",
      message: `Monitor "${monitor.name}" ${pausedNext === 1 ? "paused" : "resumed"}`,
      targetType: "monitor",
      targetId: monitor.id,
      metadata: { previousIsPaused: monitor.is_paused, isPaused: pausedNext },
    })
  }

  return NextResponse.json({ monitor: updated })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const requestId = createRequestId()
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)

  const monitor = await loadMonitorForWorkspace(params.id, ws.id)
  if (!monitor) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const db = getDatabase()
  db.prepare(`DELETE FROM monitors WHERE id = ? AND workspace_id = ?`).run(
    monitor.id,
    ws.id,
  )

  logEvent({
    workspaceId: ws.id,
    actorId: user.id,
    actorLabel: user.name,
    level: "info",
    source: "monitor",
    event: "monitor.deleted",
    message: `Monitor "${monitor.name}" deleted`,
    targetType: "monitor",
    targetId: monitor.id,
    metadata: { type: monitor.type, wasPaused: monitor.is_paused === 1 },
  })

  return NextResponse.json({ ok: true })
}
