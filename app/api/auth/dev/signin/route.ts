import { NextResponse } from "next/server"
import { HAS_CLERK, devSignInOrCreate } from "@/lib/auth"
import { ipHash } from "@/lib/ip-hash"
import { logger, createRequestId } from "@/lib/logger"
import { recordActivity } from "@/lib/activity-log"
import { logEvent } from "@/lib/logs"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  const requestId = createRequestId()
  if (HAS_CLERK) {
    return NextResponse.json(
      { ok: false, error: "Clerk is enabled; dev sign-in disabled" },
      { status: 400 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const { email, name } =
    (body as { email?: unknown; name?: unknown }) ?? {}

  if (typeof email !== "string" || typeof name !== "string") {
    return NextResponse.json(
      { ok: false, error: "email and name are required" },
      { status: 400 },
    )
  }

  const trimmedEmail = email.trim().toLowerCase()
  const trimmedName = name.trim()

  if (trimmedEmail.length < 3 || trimmedEmail.length > 200 || !EMAIL_RE.test(trimmedEmail)) {
    return NextResponse.json(
      { ok: false, error: "Invalid email address" },
      { status: 400 },
    )
  }

  if (trimmedName.length < 1 || trimmedName.length > 80) {
    return NextResponse.json(
      { ok: false, error: "Name must be 1-80 characters" },
      { status: 400 },
    )
  }

  try {
    const signedIn = await devSignInOrCreate(trimmedEmail, trimmedName)
    // Never log the raw email address — the domain alone is enough for triage.
    logEvent({
      actorId: signedIn.id,
      actorLabel: signedIn.name,
      level: "info",
      source: "auth",
      event: "auth.signin",
      message: `${signedIn.name} signed in`,
      targetType: "user",
      targetId: signedIn.id,
      metadata: { mode: "dev", emailDomain: trimmedEmail.split("@")[1] ?? null },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-in failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
