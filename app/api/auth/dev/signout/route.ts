import { NextResponse } from "next/server"
import { currentUser, devSignOut } from "@/lib/auth"
import { logEvent } from "@/lib/logs"

export async function POST() {
  try {
    // Read the actor before the cookie is cleared; never fail the sign-out for it.
    const user = await currentUser().catch(() => null)
    await devSignOut()
    logEvent({
      actorId: user?.id,
      actorLabel: user?.name,
      level: "info",
      source: "auth",
      event: "auth.signout",
      message: user ? `${user.name} signed out` : "Anonymous sign-out",
      targetType: "user",
      targetId: user?.id,
      metadata: { mode: "dev" },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign-out failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
