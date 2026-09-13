import { type NextRequest, NextResponse } from "next/server"
import { getDatabase, voteOnComment } from "@/lib/database"
import { outageEvents } from "@/lib/events"
import { ipHash } from "@/lib/ip-hash"
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

    if (!checkRate("vote:" + hash, 30, 60_000)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    // Ensure comment exists & derive company slug for the SSE broadcast
    const db = getDatabase()
    const row = db.prepare(`SELECT company_slug FROM comments WHERE id = ?`).get(cid) as
      | { company_slug: string }
      | undefined
    if (!row) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    const upvotes = voteOnComment(cid, hash)

    outageEvents.emit("comment.vote", {
      companySlug: row.company_slug,
      commentId: cid,
      upvotes,
    })

    return NextResponse.json({ upvotes })
  } catch (error) {
    console.error("Error voting on comment:", error)
    return NextResponse.json({ error: "Failed to vote" }, { status: 500 })
  }
}
