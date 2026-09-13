import { type NextRequest, NextResponse } from "next/server"
import { getCommentsForCompany, insertComment } from "@/lib/database"
import { outageEvents } from "@/lib/events"
import { ipHash } from "@/lib/ip-hash"
import { logEvent } from "@/lib/logs"
import { checkRate } from "@/lib/rate-limit"

export const runtime = "nodejs"

// Minimal placeholder bad-word list. Inappropriate words redacted.
const BAD_WORDS = [
  "badword1",
  "badword2",
  "badword3",
  "badword4",
  "badword5",
  "badword6",
  "badword7",
  "badword8",
  "badword9",
  "badword10",
]

const ALLOWED_ISSUE_TYPES = new Set(["login", "feed", "api", "mobile", "payment", "other"])

function extractIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get("x-real-ip")
  if (real) return real.trim()
  // @ts-ignore - Next.js request.ip is available in some deployments
  const reqIp = (request as any).ip
  if (typeof reqIp === "string" && reqIp) return reqIp
  return "0.0.0.0"
}

function sanitizeNickname(nickname: unknown): string | null {
  if (typeof nickname !== "string") return null
  const trimmed = nickname.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, "")
  if (cleaned.length < 1 || cleaned.length > 24) return null
  return cleaned
}

function sanitizeBody(body: string): string {
  // strip control characters, keep newlines
  return body.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim()
}

function containsBadWord(text: string): boolean {
  const lower = text.toLowerCase()
  return BAD_WORDS.some((w) => lower.includes(w))
}

async function lookupLocation(ip: string): Promise<string | null> {
  if (!ip || ip === "0.0.0.0" || ip === "unknown") return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1200)
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = (await res.json()) as { city?: string; country_code?: string; country?: string }
    const city = data.city
    const cc = data.country_code || data.country
    if (city && cc) return `${city}, ${cc}`
    if (city) return city
    if (cc) return cc
    return null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const company = url.searchParams.get("company")
    const limitParam = url.searchParams.get("limit")
    const limit = Math.min(Math.max(parseInt(limitParam || "100", 10) || 100, 1), 200)

    if (!company) {
      return NextResponse.json({ error: "Missing company slug" }, { status: 400 })
    }

    const comments = getCommentsForCompany(company, limit)
    return NextResponse.json({ comments })
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  try {
    const body = await request.json().catch(() => ({}))
    const { companySlug, issueType, nickname, body: rawBody, parentId } = body ?? {}

    if (!companySlug || typeof companySlug !== "string") {
      return NextResponse.json({ error: "Missing companySlug" }, { status: 400 })
    }
    if (typeof rawBody !== "string") {
      return NextResponse.json({ error: "Missing body" }, { status: 400 })
    }

    const cleanBody = sanitizeBody(rawBody)
    if (cleanBody.length === 0) {
      return NextResponse.json({ error: "Body is empty" }, { status: 400 })
    }
    if (cleanBody.length > 280) {
      return NextResponse.json({ error: "Body too long (max 280 chars)" }, { status: 400 })
    }

    const ip = extractIp(request)
    const hash = ipHash(ip)

    // Rate limit — 3/min per ip_hash
    if (!checkRate("comment:" + hash, 3, 60_000)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const cleanNick = sanitizeNickname(nickname)

    const cleanIssueType =
      typeof issueType === "string" && ALLOWED_ISSUE_TYPES.has(issueType) ? issueType : null

    const cleanParentId =
      typeof parentId === "number" && Number.isFinite(parentId) && parentId > 0 ? parentId : null

    // Auto-hide if bad words detected
    const status: "visible" | "hidden" = containsBadWord(cleanBody) ? "hidden" : "visible"

    // Best-effort location lookup
    const location = await lookupLocation(ip)

    const inserted = insertComment({
      company_slug: companySlug,
      issue_type: cleanIssueType,
      nickname: cleanNick,
      location,
      body: cleanBody,
      parent_id: cleanParentId,
      ip_hash: hash,
      status,
    })

    // Instrumentation only — after the insert succeeded. Never logs the raw IP
    // or the comment body; only the salted ip_hash and a length.
    const flagged = inserted.status !== "visible"
    logger.info(flagged ? "comment flagged" : "comment created", {
      requestId,
      commentId: inserted.id,
      companySlug,
      flagged,
    })
    recordActivity({
      actorType: "anonymous",
      level: flagged ? "warn" : "info",
      event: flagged ? "comment.flagged" : "comment.created",
      category: "comment",
      targetType: "comment",
      targetId: String(inserted.id),
      message: flagged
        ? `Comment auto-hidden on ${companySlug}`
        : `Comment posted on ${companySlug}`,
      metadata: {
        company_slug: companySlug,
        issue_type: cleanIssueType,
        is_reply: cleanParentId !== null,
        body_length: cleanBody.length,
        status: inserted.status,
      },
      requestId,
      ipHash: hash,
    })

    // Only broadcast visible comments so hidden posts don't appear in real time
    if (inserted.status === "visible") {
      outageEvents.emit("comment.new", {
        companySlug,
        comment: {
          id: inserted.id,
          company_slug: inserted.company_slug,
          issue_type: inserted.issue_type,
          nickname: inserted.nickname,
          location: inserted.location,
          body: inserted.body,
          parent_id: inserted.parent_id,
          upvotes: inserted.upvotes,
          status: inserted.status,
          created_at: inserted.created_at,
        },
      })
    }

    // Comment text is user content — log shape, not the body itself.
    logEvent({
      level: "info",
      source: "public",
      event: "public.comment_posted",
      message: `Comment posted on ${companySlug}`,
      targetType: "comment",
      targetId: String(inserted.id),
      ipHash: hash,
      metadata: {
        companySlug,
        issueType: cleanIssueType,
        status: inserted.status,
        isReply: cleanParentId !== null,
        bodyLength: cleanBody.length,
        hasNickname: cleanNick !== null,
      },
    })

    // Do not return ip_hash to the client
    const { ip_hash: _omit, ...safe } = inserted
    return NextResponse.json({ comment: { ...safe, replies: [] } })
  } catch (error) {
    logger.error("comment create failed", {
      requestId,
      error: error instanceof Error ? error.message : "unknown error",
    })
    console.error("Error creating comment:", error)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
