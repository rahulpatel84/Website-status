import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  const row = db
    .prepare(
      "SELECT id, kind, label, config FROM notification_channels WHERE id = ? AND workspace_id = ?",
    )
    .get(params.id, ws.id) as
    | { id: string; kind: string; label: string; config: string }
    | undefined
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const cfg = safeParse(row.config)
  const subject = "status.watch — Test alert"
  const text = `This is a test message from your status.watch workspace. Channel "${row.label}" is working.`

  let mocked = false
  try {
    if (row.kind === "email") {
      const to = cfg.to
      if (!to) return NextResponse.json({ error: "Missing recipient" }, { status: 400 })
      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import("resend")
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "alerts@statuswatch.local",
          to,
          subject,
          text,
        })
      } else {
        console.log("[email:mock]", { to, subject, text })
        mocked = true
      }
    } else if (row.kind === "slack") {
      const url = cfg.webhook_url
      if (!url) return NextResponse.json({ error: "Missing webhook URL" }, { status: 400 })
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `[test] ${text}` }),
      })
    } else if (row.kind === "webhook") {
      const url = cfg.url
      if (!url) return NextResponse.json({ error: "Missing URL" }, { status: 400 })
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "test", label: row.label, text }),
      })
    } else if (row.kind === "telegram") {
      const chatId = cfg.chat_id
      const token = process.env.TELEGRAM_BOT_TOKEN
      if (!token) {
        console.log("[telegram:mock]", { chatId, text })
        mocked = true
      } else if (chatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        })
      }
    }
    return NextResponse.json({ ok: true, mocked })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "test failed" }, { status: 500 })
  }
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
