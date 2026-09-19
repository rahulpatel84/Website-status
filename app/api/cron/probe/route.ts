import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/database"
import { runMonitor } from "@/lib/monitor-engine/runner"

function ipFromReq(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]!.trim()
  return req.headers.get("x-real-ip") || ""
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // dev-mode: only allow from localhost
    const ip = ipFromReq(req)
    return !ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("127.")
  }
  const header = req.headers.get("authorization") || ""
  return header === `Bearer ${secret}`
}

async function handler(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = getDatabase()
  const due = db
    .prepare(
      `SELECT id FROM monitors
       WHERE is_paused = 0
         AND (last_check_at IS NULL
              OR (strftime('%s','now') - strftime('%s', last_check_at)) >= interval_s)`,
    )
    .all() as { id: string }[]

  const results: { id: string; ok: boolean; error?: string }[] = []
  // Concurrency = 8
  for (let i = 0; i < due.length; i += 8) {
    const batch = due.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map((m) => runMonitor(m.id)))
    settled.forEach((s, j) => {
      if (s.status === "fulfilled") results.push({ id: batch[j].id, ok: true })
      else results.push({ id: batch[j].id, ok: false, error: String(s.reason) })
    })
  }

  return NextResponse.json({ checked: due.length, results })
}

export const GET = handler
export const POST = handler
