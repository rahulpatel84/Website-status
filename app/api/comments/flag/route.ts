import { type NextRequest, NextResponse } from "next/server"
import { flagComment, getDatabase } from "@/lib/database"
import { ipHash } from "@/lib/ip-hash"
import { logEvent } from "@/lib/logs"
import { checkRate } from "@/lib/rate-limit"

export const runtime = "nodejs"

function extractIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get("x-real-ip")
  if (real) return real.trim()
  // @ts-ignore
  const reqIp = (request as any).ip
  if (typeof reqIp === "string" && reqIp) return reqIp
  return "0.0.0.0"
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { commentId } = body ?? {}

    const cid = typeof commentId === "number" ? commentId : parseInt(String(commentId), 10)
    if (!cid || !Number.isFinite(cid) || cid <= 0) {
      return NextResponse.json({ error: "Invalid commentId" }, { status: 400 })
    }

    const ip = extractIp(request)
    const hash = ipHash(ip)

    if (!checkRate("flag:" + hash, 10, 60_000)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const db = getDatabase()
    const row = db.prepare(`SELECT id FROM comments WHERE id = ?`).get(cid) as { id: number } | undefined
    if (!row) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    const { hidden } = flagComment(cid, hash)

    logEvent({
      level: "warn",
      source: "public",
      event: "public.comment_flagged",
      message: `Comment ${cid} flagged${hidden ? " and auto-hidden" : ""}`,
      targetType: "comment",
      targetId: String(cid),
      ipHash: hash,
      metadata: { hidden },
    })

    return NextResponse.json({ flagged: true, hidden })
  } catch (error) {
    console.error("Error flagging comment:", error)
    return NextResponse.json({ error: "Failed to flag comment" }, { status: 500 })
  }
}
