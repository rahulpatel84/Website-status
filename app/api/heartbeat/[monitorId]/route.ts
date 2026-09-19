import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/database"

async function handler(
  request: Request,
  { params }: { params: { monitorId: string } },
) {
  const db = getDatabase()
  const monitor = db
    .prepare("SELECT id, current_status FROM monitors WHERE id = ?")
    .get(params.monitorId) as { id: string; current_status: string } | undefined
  if (!monitor) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    ""

  db.prepare(
    "INSERT INTO heartbeat_checkins (monitor_id, source_ip) VALUES (?, ?)",
  ).run(monitor.id, ip)

  db.prepare(
    "UPDATE monitors SET current_status='up', last_check_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(monitor.id)

  // Resolve any open incident caused by a missed heartbeat
  db.prepare(
    "UPDATE incidents SET resolved_at = CURRENT_TIMESTAMP WHERE monitor_id = ? AND resolved_at IS NULL",
  ).run(monitor.id)

  return NextResponse.json({ ok: true, received_at: new Date().toISOString() })
}

export const GET = handler
export const POST = handler
export const HEAD = handler
