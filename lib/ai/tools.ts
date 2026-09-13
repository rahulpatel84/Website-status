// Tools the AI assistant can call. Each tool returns a short human-readable
// result string that is echoed back into the conversation so the model (and
// the user) can see what happened.

import { randomUUID } from "node:crypto"
import { getDatabase } from "@/lib/database"

interface Ctx {
  userId: string
  workspaceId: string
}

interface ToolCall {
  tool: string
  args: Record<string, unknown>
}

interface ToolResult {
  ok: boolean
  message: string
  data?: unknown
}

const VALID_MONITOR_TYPES = new Set([
  "url",
  "api",
  "port",
  "ssl",
  "dns",
  "heartbeat",
  "form",
  "security-headers",
  "ssl-grade",
  "content-hash",
])

function ensureUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null
  let s = v.trim()
  if (!/^https?:\/\//i.test(s)) s = "https://" + s
  try {
    new URL(s)
    return s
  } catch {
    return null
  }
}

async function createMonitor(ctx: Ctx, args: Record<string, unknown>): Promise<ToolResult> {
  const db = getDatabase()
  const name = String(args.name || "").trim()
  const type = String(args.type || "url").trim()
  let target = String(args.target || args.url || "").trim()

  if (!name) return { ok: false, message: "Missing monitor name." }
  if (!VALID_MONITOR_TYPES.has(type))
    return { ok: false, message: `Unknown monitor type "${type}".` }

  if (type === "url" || type === "api" || type === "form" || type === "content-hash" || type === "security-headers") {
    const url = ensureUrl(target)
    if (!url) return { ok: false, message: `"${target}" is not a valid URL.` }
    target = url
  }

  const interval_s = Math.max(30, Math.min(3600, Number(args.interval_s ?? 60)))
  const regions = Array.isArray(args.regions) ? (args.regions as string[]) : ["us-east"]
  const config = typeof args.config === "object" && args.config !== null ? args.config : {}

  const id = "mon_" + randomUUID().slice(0, 12)
  db.prepare(
    `INSERT INTO monitors (id, workspace_id, name, type, target, method, interval_s, regions, config, is_paused, current_status, created_by)
     VALUES (?, ?, ?, ?, ?, 'GET', ?, ?, ?, 0, 'pending', ?)`,
  ).run(
    id,
    ctx.workspaceId,
    name,
    type,
    target,
    interval_s,
    JSON.stringify(regions),
    JSON.stringify(config),
    ctx.userId,
  )

  // Default assertion for URL/API monitors.
  if (type === "url" || type === "api") {
    db.prepare(
      "INSERT INTO assertions (id, monitor_id, kind, op, value) VALUES (?, ?, 'status_code', 'eq', '200')",
    ).run("asr_" + randomUUID().slice(0, 12), id)
  }

  return {
    ok: true,
    message: `Created ${type} monitor "${name}" (id ${id}) targeting ${target}.`,
    data: { id, name, type, target, interval_s },
  }
}

async function listMonitors(ctx: Ctx): Promise<ToolResult> {
  const db = getDatabase()
  const rows = db
    .prepare(
      "SELECT id, name, type, target, current_status, interval_s FROM monitors WHERE workspace_id = ? ORDER BY created_at DESC",
    )
    .all(ctx.workspaceId) as {
    id: string
    name: string
    type: string
    target: string
    current_status: string
    interval_s: number
  }[]

  if (rows.length === 0) return { ok: true, message: "No monitors yet." }
  const lines = rows
    .slice(0, 20)
    .map((m) => `• [${m.current_status}] ${m.name} (${m.type}) — ${m.target}, every ${m.interval_s}s`)
    .join("\n")
  return {
    ok: true,
    message: `Found ${rows.length} monitor${rows.length === 1 ? "" : "s"}:\n${lines}`,
    data: rows,
  }
}

async function pauseMonitor(ctx: Ctx, args: Record<string, unknown>): Promise<ToolResult> {
  const db = getDatabase()
  const id = String(args.id || "")
  if (!id) return { ok: false, message: "Missing monitor id." }
  const res = db
    .prepare("UPDATE monitors SET is_paused = 1 WHERE id = ? AND workspace_id = ?")
    .run(id, ctx.workspaceId)
  return res.changes > 0
    ? { ok: true, message: `Paused monitor ${id}.` }
    : { ok: false, message: `Monitor ${id} not found in your workspace.` }
}

async function resumeMonitor(ctx: Ctx, args: Record<string, unknown>): Promise<ToolResult> {
  const db = getDatabase()
  const id = String(args.id || "")
  if (!id) return { ok: false, message: "Missing monitor id." }
  const res = db
    .prepare("UPDATE monitors SET is_paused = 0 WHERE id = ? AND workspace_id = ?")
    .run(id, ctx.workspaceId)
  return res.changes > 0
    ? { ok: true, message: `Resumed monitor ${id}.` }
    : { ok: false, message: `Monitor ${id} not found in your workspace.` }
}

async function createStatusPage(ctx: Ctx, args: Record<string, unknown>): Promise<ToolResult> {
  const db = getDatabase()
  const name = String(args.name || "").trim() || "New status page"
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "page"
  let slug = base
  let n = 1
  while (db.prepare("SELECT 1 FROM status_pages WHERE slug = ?").get(slug)) {
    slug = `${base}-${n++}`
  }
  const id = "sp_" + randomUUID().slice(0, 12)
  db.prepare(
    "INSERT INTO status_pages (id, workspace_id, slug, name, accent_color, visibility) VALUES (?, ?, ?, ?, '#F97316', 'public')",
  ).run(id, ctx.workspaceId, slug, name)
  return {
    ok: true,
    message: `Created status page "${name}" at /status/${slug}.`,
    data: { id, slug, name },
  }
}

const TOOLS: Record<
  string,
  (ctx: Ctx, args: Record<string, unknown>) => Promise<ToolResult>
> = {
  create_monitor: createMonitor,
  list_monitors: listMonitors,
  pause_monitor: pauseMonitor,
  resume_monitor: resumeMonitor,
  create_status_page: createStatusPage,
}

export async function runTool(ctx: Ctx, call: ToolCall): Promise<ToolResult> {
  const fn = TOOLS[call.tool]
  if (!fn) return { ok: false, message: `Unknown tool: ${call.tool}` }
  try {
    return await fn(ctx, call.args ?? {})
  } catch (e: any) {
    return { ok: false, message: `Tool ${call.tool} failed: ${e?.message ?? "unknown"}` }
  }
}

export const TOOL_SPEC = `
Available tools (call zero or more per turn):

- create_monitor({ name: string, type: "url"|"api"|"port"|"ssl"|"dns"|"heartbeat"|"form"|"security-headers"|"ssl-grade"|"content-hash", target: string, interval_s?: number })
    Creates a monitor. Defaults to url type. Interval default 60s.
- list_monitors()
    Returns every monitor in the workspace.
- pause_monitor({ id: string })
- resume_monitor({ id: string })
- create_status_page({ name: string })
    Creates a public status page. Slug is auto-generated.

Respond with a JSON object of this exact shape (no markdown, no code fences, no explanations outside JSON):

{
  "message": "short user-facing reply",
  "actions": [
    { "tool": "create_monitor", "args": { "name": "...", "type": "url", "target": "https://..." } }
  ]
}

If no actions are needed, return { "message": "...", "actions": [] }.
`
