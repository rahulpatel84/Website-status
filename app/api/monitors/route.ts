import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { logger, createRequestId } from "@/lib/logger"
import { recordActivity } from "@/lib/activity-log"
import { logEvent } from "@/lib/logs"

const MONITOR_TYPES = new Set([
  "url",
  "api",
  "port",
  "ssl",
  "dns",
  "heartbeat",
  "form",
  "security-headers",
  "ssl-grade",
  "content-hash",
])

const ASSERTION_KINDS = new Set(["status_code", "body", "response_ms", "header"])
const ASSERTION_OPS = new Set(["eq", "ne", "lt", "gt", "contains"])

interface AssertionInput {
  kind: string
  op: string
  value: unknown
}

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()

  const rows = db
    .prepare(
      `SELECT id, workspace_id, name, type, target, method, interval_s, regions, config,
              is_paused, current_status, last_check_at, last_response_ms, created_by,
              created_at, updated_at
       FROM monitors
       WHERE workspace_id = ?
       ORDER BY created_at DESC`,
    )
    .all(ws.id)

  return NextResponse.json({ monitors: rows })
}

export async function POST(request: Request) {
  const requestId = createRequestId()
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    logEvent({
      workspaceId: ws.id,
      actorId: user.id,
      actorLabel: user.name,
      level: "warn",
      source: "monitor",
      event: "monitor.create_failed",
      message: "Monitor creation rejected: invalid JSON body",
      metadata: { reason: "invalid_json" },
    })
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = String(body.name ?? "").trim()
  const type = String(body.type ?? "").trim()
  const target = String(body.target ?? "").trim()
  const method = body.method ? String(body.method).toUpperCase() : "GET"
  const interval_s = Number.isFinite(Number(body.interval_s))
    ? Math.max(10, Math.min(86400, Number(body.interval_s)))
    : 60
  const regionsInput = Array.isArray(body.regions) ? body.regions : ["us-east"]
  const regions = regionsInput.map((r) => String(r)).filter(Boolean)
  const config =
    body.config && typeof body.config === "object" && !Array.isArray(body.config)
      ? (body.config as Record<string, unknown>)
      : {}
  const assertions = Array.isArray(body.assertions)
    ? (body.assertions as AssertionInput[])
    : []

  if (!name) {
    logEvent({
      workspaceId: ws.id,
      actorId: user.id,
      actorLabel: user.name,
      level: "warn",
      source: "monitor",
      event: "monitor.create_failed",
      message: "Monitor creation rejected: name is required",
      metadata: { reason: "name_required", type },
    })
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (!MONITOR_TYPES.has(type)) {
    logEvent({
      workspaceId: ws.id,
      actorId: user.id,
      actorLabel: user.name,
      level: "warn",
      source: "monitor",
      event: "monitor.create_failed",
      message: `Monitor creation rejected: invalid type "${type}"`,
      metadata: { reason: "invalid_type", type },
    })
    return NextResponse.json({ error: "invalid type" }, { status: 400 })
  }
  if (!target && type !== "heartbeat") {
    logEvent({
      workspaceId: ws.id,
      actorId: user.id,
      actorLabel: user.name,
      level: "warn",
      source: "monitor",
      event: "monitor.create_failed",
      message: "Monitor creation rejected: target is required",
      metadata: { reason: "target_required", type },
    })
    return NextResponse.json({ error: "target is required" }, { status: 400 })
  }

  const db = getDatabase()
  const monitorId = "mon_" + randomUUID().replace(/-/g, "").slice(0, 12)
  const now = new Date().toISOString()

  const insertMonitor = db.prepare(
    `INSERT INTO monitors (
       id, workspace_id, name, type, target, method, interval_s, regions, config,
       is_paused, current_status, created_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?)`,
  )

  const insertAssertion = db.prepare(
    `INSERT INTO assertions (id, monitor_id, kind, op, value) VALUES (?, ?, ?, ?, ?)`,
  )

  const tx = db.transaction(() => {
    insertMonitor.run(
      monitorId,
      ws.id,
      name,
      type,
      target || monitorId,
      method,
      interval_s,
      JSON.stringify(regions.length ? regions : ["us-east"]),
      JSON.stringify(config),
      user.id,
      now,
      now,
    )

    for (const a of assertions) {
      const kind = String(a?.kind ?? "")
      const op = String(a?.op ?? "")
      if (!ASSERTION_KINDS.has(kind) || !ASSERTION_OPS.has(op)) continue
      const valueStr =
        typeof a.value === "string"
          ? a.value
          : JSON.stringify(a.value ?? "")
      const aid = "asr_" + randomUUID().replace(/-/g, "").slice(0, 12)
      insertAssertion.run(aid, monitorId, kind, op, valueStr)
    }
  })
  tx()

  const created = db
    .prepare(`SELECT * FROM monitors WHERE id = ?`)
    .get(monitorId)

  logEvent({
    workspaceId: ws.id,
    actorId: user.id,
    actorLabel: user.name,
    level: "info",
    source: "monitor",
    event: "monitor.created",
    message: `Monitor "${name}" created`,
    targetType: "monitor",
    targetId: monitorId,
    metadata: {
      type,
      method,
      interval_s,
      regions,
      assertionCount: assertions.length,
    },
  })

  return NextResponse.json({ monitor: created }, { status: 201 })
}
