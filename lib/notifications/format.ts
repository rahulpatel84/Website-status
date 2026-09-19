// Channel-agnostic alert formatter. Each destination has its own preferred
// markup dialect, so we build all of them from a single struct.

export type AlertKind = "open" | "renotify" | "recovered" | "test"

export interface AlertContext {
  kind: AlertKind
  monitor: {
    id: string
    name: string
    target: string
    type: string
  }
  incident?: {
    layer_isolated: string | null
    cause: string | null
    started_at: string | null
  }
  /** For "recovered" alerts — humanised outage duration ("2h 14m"). */
  outage_duration?: string | null
  /** Absolute link back to the monitor detail page in the app. */
  monitor_url?: string | null
}

export interface FormattedAlert {
  /** Email subject / one-liner summary for logs. */
  subject: string
  /** Plain text fallback (email body, Slack fallback, generic webhook). */
  text: string
  /** Telegram HTML (parse_mode=HTML). Uses <b>, <i>, <a>, escaped entities. */
  telegramHtml: string
  /** Slack mrkdwn (surrounds fields with *bold* and uses <url|label> links). */
  slackMrkdwn: string
}

interface KindMeta {
  emoji: string
  label: string
}

const KIND: Record<AlertKind, KindMeta> = {
  open: { emoji: "🔴", label: "DOWN" },
  renotify: { emoji: "🟠", label: "STILL DOWN" },
  recovered: { emoji: "🟢", label: "RECOVERED" },
  test: { emoji: "🧪", label: "TEST ALERT" },
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatStartedAt(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z")
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function humaniseSince(iso: string): string {
  const start = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime()
  if (!Number.isFinite(start)) return ""
  const ms = Date.now() - start
  if (ms < 60_000) return "just now"
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h < 24) return rem ? `${h}h ${rem}m` : `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

export function formatAlert(ctx: AlertContext): FormattedAlert {
  const meta = KIND[ctx.kind]
  const { monitor, incident, monitor_url, outage_duration } = ctx

  const layer = incident?.layer_isolated ?? null
  const cause = incident?.cause ?? null
  const startedAt = incident?.started_at ?? null

  // Optional "duration so far" for renotify — helps operators see how long the
  // outage has been running without opening the app.
  const ageBadge =
    ctx.kind === "renotify" && startedAt ? ` (${humaniseSince(startedAt)})` : ""
  const recoveredBadge =
    ctx.kind === "recovered" && outage_duration ? ` (was down ${outage_duration})` : ""

  const headline = `${meta.label} · ${monitor.name}${ageBadge}${recoveredBadge}`
  const subject = `[status.watch] ${meta.emoji} ${headline}`

  // ----- Plain text -----
  const textLines: string[] = [`${meta.emoji} ${headline}`, ""]
  textLines.push(`URL: ${monitor.target}`)
  if (layer) textLines.push(`Layer: ${layer.toUpperCase()}`)
  if (cause) textLines.push(`Cause: ${cause}`)
  if (startedAt && ctx.kind !== "test" && ctx.kind !== "recovered") {
    textLines.push(`Since: ${formatStartedAt(startedAt)}`)
  }
  if (ctx.kind === "test") {
    textLines.push("")
    textLines.push(
      "If you see this, alerts to your channels are wired correctly.",
    )
    textLines.push("Real alerts fire only on state transitions (up → down).")
  }
  if (monitor_url) {
    textLines.push("")
    textLines.push(`Open: ${monitor_url}`)
  }
  const text = textLines.join("\n")

  // ----- Telegram HTML -----
  const tgLines: string[] = [
    `${meta.emoji} <b>${escHtml(meta.label)}</b> · <b>${escHtml(monitor.name)}</b>${escHtml(ageBadge)}${escHtml(recoveredBadge)}`,
    "",
    `<b>URL:</b> ${escHtml(monitor.target)}`,
  ]
  if (layer) tgLines.push(`<b>Layer:</b> ${escHtml(layer.toUpperCase())}`)
  if (cause) tgLines.push(`<b>Cause:</b> <code>${escHtml(cause)}</code>`)
  if (startedAt && ctx.kind !== "test" && ctx.kind !== "recovered") {
    tgLines.push(`<b>Since:</b> ${escHtml(formatStartedAt(startedAt))}`)
  }
  if (ctx.kind === "test") {
    tgLines.push("")
    tgLines.push(
      "<i>If you see this, alerts to your channels are wired correctly. Real alerts fire only on state transitions (up → down).</i>",
    )
  }
  if (monitor_url) {
    tgLines.push("")
    tgLines.push(`<a href="${escHtml(monitor_url)}">Open in status.watch →</a>`)
  }
  const telegramHtml = tgLines.join("\n")

  // ----- Slack mrkdwn -----
  const slLines: string[] = [
    `${meta.emoji} *${meta.label}* · *${monitor.name}*${ageBadge}${recoveredBadge}`,
    "",
    `*URL:* ${monitor.target}`,
  ]
  if (layer) slLines.push(`*Layer:* ${layer.toUpperCase()}`)
  if (cause) slLines.push(`*Cause:* \`${cause}\``)
  if (startedAt && ctx.kind !== "test" && ctx.kind !== "recovered") {
    slLines.push(`*Since:* ${formatStartedAt(startedAt)}`)
  }
  if (ctx.kind === "test") {
    slLines.push("")
    slLines.push(
      "_If you see this, alerts to your channels are wired correctly. Real alerts fire only on state transitions (up → down)._",
    )
  }
  if (monitor_url) {
    slLines.push("")
    slLines.push(`<${monitor_url}|Open in status.watch →>`)
  }
  const slackMrkdwn = slLines.join("\n")

  return { subject, text, telegramHtml, slackMrkdwn }
}

/** Absolute URL to a monitor detail page, or null if NEXT_PUBLIC_APP_URL isn't set. */
export function monitorUrl(monitorId: string): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!base) return null
  return `${base.replace(/\/$/, "")}/app/monitors/${monitorId}`
}
