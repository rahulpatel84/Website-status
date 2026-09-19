// Dispatch — sends incident notifications to all channels attached to a monitor.
// Each channel has its own renotify cadence (config.notify_every_min); we track
// per-channel timing in incident_channel_notifications so channels don't step
// on each other's schedules.
import { getDatabase } from "@/lib/database"
import { formatAlert, monitorUrl, type AlertKind } from "./format"

interface ChannelRow {
  id: string
  kind: string
  label: string
  config: string
}

interface MonitorRow {
  id: string
  name: string
  target: string
  type: string
  workspace_id: string
}

interface IncidentRow {
  id: string
  monitor_id: string
  layer_isolated: string | null
  cause: string | null
  severity: string
  started_at: string
  resolved_at: string | null
}

interface ChannelNotifyRow {
  incident_id: string
  channel_id: string
  last_notified_at: string
  notify_count: number
}

function parse<T = any>(s: string): T {
  try {
    return JSON.parse(s)
  } catch {
    return {} as T
  }
}

/** Global default cadence (minutes) when a channel has no per-channel override. */
function defaultRenotifyMin(): number {
  const n = Number(process.env.RENOTIFY_INTERVAL_MIN ?? "30")
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Returns the effective renotify cadence for a channel in minutes, or 0 when
 * renotification is disabled. Channel-config values take precedence, then the
 * env default. `notify_every_min = 0` means "off — only initial alert".
 */
function channelRenotifyMin(cfg: any): number {
  const raw = cfg?.notify_every_min
  if (raw === 0 || raw === "0") return 0
  const parsed = Number(raw)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return defaultRenotifyMin()
}

export async function dispatchIncidentByMonitor(monitorId: string): Promise<{
  channel_count: number
} | null> {
  const db = getDatabase()
  const incident = db
    .prepare(
      "SELECT * FROM incidents WHERE monitor_id = ? AND resolved_at IS NULL ORDER BY started_at DESC LIMIT 1",
    )
    .get(monitorId) as IncidentRow | undefined
  if (!incident) return null
  return dispatchIncident(incident.id)
}

export async function dispatchIncident(
  incidentId: string,
  opts: { renotify?: boolean } = {},
): Promise<{ channel_count: number } | null> {
  const db = getDatabase()
  const incident = db
    .prepare("SELECT * FROM incidents WHERE id = ?")
    .get(incidentId) as IncidentRow | undefined
  if (!incident) return null
  const monitor = db
    .prepare("SELECT id, name, target, type, workspace_id FROM monitors WHERE id = ?")
    .get(incident.monitor_id) as MonitorRow | undefined
  if (!monitor) return null

  const channels = db
    .prepare(
      `SELECT nc.id, nc.kind, nc.label, nc.config
       FROM notification_channels nc
       JOIN monitor_channels mc ON mc.channel_id = nc.id
       WHERE mc.monitor_id = ?`,
    )
    .all(monitor.id) as ChannelRow[]

  // Fallback: if no per-monitor channels, use all workspace channels.
  const fanout =
    channels.length > 0
      ? channels
      : (db
          .prepare("SELECT id, kind, label, config FROM notification_channels WHERE workspace_id = ?")
          .all(monitor.workspace_id) as ChannelRow[])

  const kind: AlertKind = opts.renotify ? "renotify" : "open"
  const formatted = formatAlert({
    kind,
    monitor: {
      id: monitor.id,
      name: monitor.name,
      target: monitor.target,
      type: monitor.type,
    },
    incident: {
      layer_isolated: incident.layer_isolated,
      cause: incident.cause,
      started_at: incident.started_at,
    },
    monitor_url: monitorUrl(monitor.id),
  })

  let notifiedCount = 0
  await Promise.allSettled(
    fanout.map(async (c) => {
      const ok = await sendToChannel(c, formatted, incident, monitor, kind)
      if (ok) {
        notifiedCount++
        recordChannelNotification(incident.id, c.id)
      }
    }),
  )

  // Keep the incident-wide clock in sync too — used for the ongoing-incident
  // "last notified" display and as a defensive floor when a channel is added
  // mid-incident.
  db.prepare("UPDATE incidents SET last_notified_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    incident.id,
  )

  return { channel_count: notifiedCount }
}

async function sendToChannel(
  c: ChannelRow,
  formatted: ReturnType<typeof formatAlert>,
  incident: IncidentRow,
  monitor: MonitorRow,
  kind: AlertKind,
): Promise<boolean> {
  const cfg = parse(c.config)
  try {
    if (c.kind === "email") {
      const to = cfg.to
      if (!to) return false
      if (process.env.RESEND_API_KEY) {
        const { Resend } = await import("resend")
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "alerts@statuswatch.local",
          to,
          subject: formatted.subject,
          text: formatted.text,
        })
      } else {
        console.log("[email:mock]", { to, subject: formatted.subject, text: formatted.text })
      }
      return true
    }
    if (c.kind === "slack") {
      const url = cfg.webhook_url
      if (!url) return false
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: formatted.slackMrkdwn, mrkdwn: true }),
      })
      return true
    }
    if (c.kind === "webhook") {
      const url = cfg.url
      if (!url) return false
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: kind === "renotify" ? "incident.renotify" : "incident.opened",
          incident,
          monitor,
          text: formatted.text,
        }),
      })
      return true
    }
    if (c.kind === "telegram") {
      const token = process.env.TELEGRAM_BOT_TOKEN
      const chatId = cfg.chat_id
      if (!token || !chatId) {
        console.log("[telegram:mock]", { chatId, text: formatted.telegramHtml })
        return true
      }
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: formatted.telegramHtml,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      })
      return true
    }
    return false
  } catch (e) {
    console.error("[dispatch] channel failed", c.kind, e)
    return false
  }
}

function recordChannelNotification(incidentId: string, channelId: string): void {
  const db = getDatabase()
  db.prepare(
    `INSERT INTO incident_channel_notifications (incident_id, channel_id, last_notified_at, notify_count)
     VALUES (?, ?, CURRENT_TIMESTAMP, 1)
     ON CONFLICT(incident_id, channel_id) DO UPDATE SET
       last_notified_at = CURRENT_TIMESTAMP,
       notify_count = notify_count + 1`,
  ).run(incidentId, channelId)
}

/**
 * Re-dispatch the ongoing incident for a monitor — but only to the channels
 * whose per-channel cadence says they're due. Each channel can have its own
 * `notify_every_min` in its config JSON; falls back to `RENOTIFY_INTERVAL_MIN`
 * env (default 30). A cadence of 0 means "only initial alert, no renotify".
 */
export async function renotifyOngoingIfDue(monitorId: string): Promise<boolean> {
  const db = getDatabase()
  const incident = db
    .prepare(
      "SELECT id, monitor_id, workspace_id, started_at, resolved_at, layer_isolated, cause, severity FROM incidents WHERE monitor_id = ? AND resolved_at IS NULL ORDER BY started_at DESC LIMIT 1",
    )
    .get(monitorId) as IncidentRow | undefined
  if (!incident) return false

  const monitor = db
    .prepare("SELECT id, name, target, type, workspace_id FROM monitors WHERE id = ?")
    .get(incident.monitor_id) as MonitorRow | undefined
  if (!monitor) return false

  const attached = db
    .prepare(
      `SELECT nc.id, nc.kind, nc.label, nc.config
       FROM notification_channels nc
       JOIN monitor_channels mc ON mc.channel_id = nc.id
       WHERE mc.monitor_id = ?`,
    )
    .all(monitor.id) as ChannelRow[]

  const fanout =
    attached.length > 0
      ? attached
      : (db
          .prepare("SELECT id, kind, label, config FROM notification_channels WHERE workspace_id = ?")
          .all(monitor.workspace_id) as ChannelRow[])

  if (fanout.length === 0) return false

  const stmtLast = db.prepare(
    "SELECT incident_id, channel_id, last_notified_at, notify_count FROM incident_channel_notifications WHERE incident_id = ? AND channel_id = ?",
  )

  // Filter to channels that are actually due for a renotify right now.
  const due: ChannelRow[] = []
  for (const c of fanout) {
    const cfg = parse(c.config)
    const cadence = channelRenotifyMin(cfg)
    if (cadence <= 0) continue // "Off" — send only the initial alert
    const row = stmtLast.get(incident.id, c.id) as ChannelNotifyRow | undefined
    if (!row) {
      // Channel was added mid-incident and hasn't seen the initial alert yet
      // — send this pass so they get caught up.
      due.push(c)
      continue
    }
    const last = new Date(row.last_notified_at + "Z").getTime()
    if (!Number.isFinite(last)) {
      due.push(c)
      continue
    }
    if (Date.now() - last >= cadence * 60 * 1000) due.push(c)
  }

  if (due.length === 0) return false

  const formatted = formatAlert({
    kind: "renotify",
    monitor: {
      id: monitor.id,
      name: monitor.name,
      target: monitor.target,
      type: monitor.type,
    },
    incident: {
      layer_isolated: incident.layer_isolated,
      cause: incident.cause,
      started_at: incident.started_at,
    },
    monitor_url: monitorUrl(monitor.id),
  })

  await Promise.allSettled(
    due.map(async (c) => {
      const ok = await sendToChannel(c, formatted, incident, monitor, "renotify")
      if (ok) recordChannelNotification(incident.id, c.id)
    }),
  )

  db.prepare("UPDATE incidents SET last_notified_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    incident.id,
  )
  return true
}
