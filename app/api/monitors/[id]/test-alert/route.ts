import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { formatAlert, monitorUrl } from "@/lib/notifications/format"

interface MonitorRow {
  id: string
  workspace_id: string
  name: string
  target: string
  type: string
}

interface ChannelRow {
  id: string
  kind: string
  label: string
  config: string
}

function parse<T = any>(s: string): T {
  try {
    return JSON.parse(s)
  } catch {
    return {} as T
  }
}

/**
 * Fires a synthetic alert through every notification channel attached to the
 * monitor — or, if none are attached, every channel in the workspace. Uses
 * plain text, no channel-verification bypass. Purely for "did I wire this up
 * right?" testing.
 */
export async function POST(
  _r: Request,
  { params }: { params: { id: string } },
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()

  const monitor = db
    .prepare(
      "SELECT id, workspace_id, name, target, type FROM monitors WHERE id = ? AND workspace_id = ?",
    )
    .get(params.id, ws.id) as MonitorRow | undefined
  if (!monitor) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const bound = db
    .prepare(
      `SELECT nc.id, nc.kind, nc.label, nc.config
       FROM notification_channels nc
       JOIN monitor_channels mc ON mc.channel_id = nc.id
       WHERE mc.monitor_id = ?`,
    )
    .all(monitor.id) as ChannelRow[]

  const channels =
    bound.length > 0
      ? bound
      : (db
          .prepare(
            "SELECT id, kind, label, config FROM notification_channels WHERE workspace_id = ?",
          )
          .all(ws.id) as ChannelRow[])

  const formatted = formatAlert({
    kind: "test",
    monitor: {
      id: monitor.id,
      name: monitor.name,
      target: monitor.target,
      type: monitor.type,
    },
    monitor_url: monitorUrl(monitor.id),
  })

  const results: Array<{ kind: string; label: string; ok: boolean; mocked?: boolean; error?: string }> =
    []

  for (const c of channels) {
    const cfg = parse(c.config)
    try {
      if (c.kind === "email") {
        const to = cfg.to
        if (!to) {
          results.push({ kind: c.kind, label: c.label, ok: false, error: "missing recipient" })
          continue
        }
        if (process.env.RESEND_API_KEY) {
          const { Resend } = await import("resend")
          const resend = new Resend(process.env.RESEND_API_KEY)
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to,
            subject: formatted.subject,
            text: formatted.text,
          })
          results.push({ kind: c.kind, label: c.label, ok: true })
        } else {
          console.log("[email:mock]", { to, text: formatted.text })
          results.push({ kind: c.kind, label: c.label, ok: true, mocked: true })
        }
      } else if (c.kind === "slack") {
        if (!cfg.webhook_url) {
          results.push({ kind: c.kind, label: c.label, ok: false, error: "missing webhook_url" })
          continue
        }
        const r = await fetch(cfg.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: formatted.slackMrkdwn, mrkdwn: true }),
        })
        results.push({ kind: c.kind, label: c.label, ok: r.ok })
      } else if (c.kind === "webhook") {
        if (!cfg.url) {
          results.push({ kind: c.kind, label: c.label, ok: false, error: "missing url" })
          continue
        }
        const r = await fetch(cfg.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "test", monitor: monitor.name, text: formatted.text }),
        })
        results.push({ kind: c.kind, label: c.label, ok: r.ok })
      } else if (c.kind === "telegram") {
        const token = process.env.TELEGRAM_BOT_TOKEN
        if (!token || !cfg.chat_id) {
          console.log("[telegram:mock]", { chatId: cfg.chat_id, text: formatted.telegramHtml })
          results.push({
            kind: c.kind,
            label: c.label,
            ok: true,
            mocked: true,
            error: !token ? "TELEGRAM_BOT_TOKEN not set" : undefined,
          })
          continue
        }
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cfg.chat_id,
            text: formatted.telegramHtml,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        })
        const body = await r.json().catch(() => ({}))
        results.push({
          kind: c.kind,
          label: c.label,
          ok: r.ok && body.ok !== false,
          error: r.ok ? undefined : String(body?.description ?? r.status),
        })
      } else {
        results.push({ kind: c.kind, label: c.label, ok: false, error: "unsupported kind" })
      }
    } catch (e: any) {
      results.push({ kind: c.kind, label: c.label, ok: false, error: e?.message ?? "error" })
    }
  }

  return NextResponse.json({
    ok: results.every((r) => r.ok),
    channel_count: channels.length,
    binding_source: bound.length > 0 ? "monitor_channels" : "workspace_fallback",
    results,
  })
}
