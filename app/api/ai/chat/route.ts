import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { chatCompletion, type ChatMessage } from "@/lib/ai/openrouter"
import { runTool, TOOL_SPEC } from "@/lib/ai/tools"

const SYSTEM = `You are the AI assistant embedded in status.watch, an uptime + status-page platform.
Your job is to help the signed-in user configure their monitoring setup by CALLING the tools below.

You MUST answer with a single JSON object. No markdown, no code fences, no prose outside JSON.

Shape:
{
  "message": "short reply to show the user",
  "actions": [ { "tool": "<tool_name>", "args": { ... } }, ... ]
}

When to call which tool — VERY IMPORTANT:
- If the user asks to see, show, list, get, or how many monitors → put a { "tool": "list_monitors", "args": {} } in actions.
- If the user asks to create/add/make a monitor → put a create_monitor action.
- If the user asks to make/create a status page → create_status_page.
- If the user asks to pause/stop a monitor → pause_monitor.
- If the user asks to resume/start a monitor → resume_monitor.
- Never say "here are your monitors" without also including the list_monitors action.
- Never say "I've created" without the corresponding create_ action.

Sensible defaults for create_monitor:
- default type = "url"
- default interval_s = 60
- default name = the bare domain (e.g. "acme.io")
- if the target is missing scheme, treat as https://

${TOOL_SPEC}

=== EXAMPLES ===

USER: Show me all my monitors
YOU: {"message":"Here are your monitors:","actions":[{"tool":"list_monitors","args":{}}]}

USER: How many monitors do I have?
YOU: {"message":"Let me check.","actions":[{"tool":"list_monitors","args":{}}]}

USER: Create a URL monitor for vercel.com every 60 seconds
YOU: {"message":"Creating a URL monitor for vercel.com.","actions":[{"tool":"create_monitor","args":{"name":"vercel.com","type":"url","target":"https://vercel.com","interval_s":60}}]}

USER: Add an SSL grade monitor for github.com
YOU: {"message":"Creating an SSL grade monitor for github.com.","actions":[{"tool":"create_monitor","args":{"name":"github.com SSL","type":"ssl-grade","target":"github.com"}}]}

USER: Make a status page called Acme Systems
YOU: {"message":"Creating a status page named Acme Systems.","actions":[{"tool":"create_status_page","args":{"name":"Acme Systems"}}]}

USER: Hi, what can you do?
YOU: {"message":"I can create monitors (URL, API, SSL, form, heartbeat, security-headers, etc), list them, pause/resume them, and create status pages. Just describe what you want.","actions":[]}
`

// Simple regex-based intent detection used as a safety net when the model
// forgot to include a list_monitors action but clearly means to list.
const LIST_INTENT =
  /\b(show|list|see|get|display|what are|what're|how many|all)\b[^?]*\bmonitor/i

export async function POST(request: Request) {
  let auth
  try {
    auth = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const history: ChatMessage[] = Array.isArray(body.messages) ? body.messages : []
  const userMsg = String(body.message || "").trim()
  if (!userMsg) return NextResponse.json({ error: "Empty message" }, { status: 400 })

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    ...history.slice(-10),
    { role: "user", content: userMsg },
  ]

  const llm = await chatCompletion(messages, { responseAsJson: true })
  if (!llm.ok) {
    return NextResponse.json({
      ok: false,
      reply: llm.text,
      actions: [],
      error: llm.error,
    })
  }

  let parsed: { message?: string; actions?: any[] } = {}
  try {
    parsed = JSON.parse(extractJson(llm.text))
  } catch {
    // Model ignored the JSON rule — fall back to plain text but still try
    // to detect obvious intents.
    parsed = { message: llm.text.trim(), actions: [] }
  }

  let calls: any[] = Array.isArray(parsed.actions) ? parsed.actions.slice(0, 5) : []

  // Safety-net: user clearly asked to list monitors but model forgot the tool.
  if (calls.length === 0 && LIST_INTENT.test(userMsg)) {
    calls.push({ tool: "list_monitors", args: {} })
  }

  const results: { tool: string; ok: boolean; message: string; data?: unknown }[] = []
  for (const call of calls) {
    if (!call || typeof call.tool !== "string") continue
    const r = await runTool(
      { userId: auth.user.id, workspaceId: auth.workspace.id },
      { tool: call.tool, args: (call.args as Record<string, unknown>) ?? {} },
    )
    results.push({ tool: call.tool, ok: r.ok, message: r.message, data: r.data })
  }

  return NextResponse.json({
    ok: true,
    reply: (parsed.message || "").trim() || "Done.",
    actions: results,
    model: llm.model,
  })
}

/** Pull the first JSON object out of the string in case the model wrapped it. */
function extractJson(s: string): string {
  const trimmed = s.trim()
  if (trimmed.startsWith("{")) return trimmed
  const m = trimmed.match(/\{[\s\S]*\}/)
  return m ? m[0] : trimmed
}
