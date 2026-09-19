import { NextResponse } from "next/server"
import { unlink } from "node:fs/promises"
import path from "node:path"
import { getDatabase } from "@/lib/database"

interface Row {
  id: number
  path: string
}

function ipFromReq(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]!.trim()
  return req.headers.get("x-real-ip") || ""
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    const ip = ipFromReq(req)
    return !ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("127.")
  }
  return req.headers.get("authorization") === `Bearer ${secret}`
}

/**
 * Delete probe_screenshots rows past their expires_at (default 7 days after
 * capture) and the backing PNG file. Idempotent.
 */
async function handler(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const db = getDatabase()
  const expired = db
    .prepare(
      "SELECT id, path FROM probe_screenshots WHERE expires_at <= datetime('now') ORDER BY id LIMIT 500",
    )
    .all() as Row[]

  let deleted_rows = 0
  let deleted_files = 0
  const del = db.prepare("DELETE FROM probe_screenshots WHERE id = ?")

  for (const row of expired) {
    const abs = path.join(process.cwd(), "public", row.path.replace(/^\//, ""))
    try {
      await unlink(abs)
      deleted_files++
    } catch {
      /* file may already be gone */
    }
    del.run(row.id)
    deleted_rows++
  }
  return NextResponse.json({
    ok: true,
    considered: expired.length,
    deleted_rows,
    deleted_files,
  })
}

export const GET = handler
export const POST = handler
