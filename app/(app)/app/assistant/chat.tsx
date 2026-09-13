"use client"

import { useEffect, useRef, useState } from "react"
import { Bot, Loader2, Send, Sparkles, Trash2, User } from "lucide-react"

const STORAGE_KEY = "sw:assistant:history:v1"
const MAX_HISTORY = 50

interface ActionResult {
  tool: string
  ok: boolean
  message: string
  data?: any
}

interface Msg {
  role: "user" | "assistant"
  content: string
  actions?: ActionResult[]
  model?: string
}

const SUGGESTIONS = [
  "Create a URL monitor for https://vercel.com every 60 seconds",
  "Make a SSL grade monitor for github.com",
  "Create a status page called 'Acme Systems'",
  "Show me all my monitors",
  "Add a security-headers monitor for my site https://rahulpatel.me",
]

export function AssistantChat({ hasKey }: { hasKey: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)

  // Load history on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setMessages(JSON.parse(raw))
    } catch {}
    setHydrated(true)
  }, [])

  // Persist history whenever it changes (after hydration to avoid clobbering)
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)))
    } catch {}
  }, [messages, hydrated])

  function clearHistory() {
    if (!confirm("Clear the entire chat history? This cannot be undone.")) return
    setMessages([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput("")
    const prior: Msg[] = [...messages, { role: "user", content: msg }]
    setMessages(prior)
    setLoading(true)
    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const j = await r.json()
      setMessages([
        ...prior,
        {
          role: "assistant",
          content: j.reply || j.error || "(no reply)",
          actions: j.actions ?? [],
          model: j.model,
        },
      ])
    } catch (e: any) {
      setMessages([
        ...prior,
        { role: "assistant", content: `Request failed: ${e?.message || "unknown"}` },
      ])
    } finally {
      setLoading(false)
      requestAnimationFrame(() =>
        scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" }),
      )
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
        <span>
          {messages.length === 0
            ? "New conversation"
            : `${messages.length} message${messages.length === 1 ? "" : "s"} · history saved in this browser`}
        </span>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <Trash2 className="w-3 h-3" /> Clear history
          </button>
        )}
      </div>

      {!hasKey && (
        <div className="border-b border-border bg-[color:var(--brand-50)] text-[color:var(--brand-700)] px-4 py-2 text-xs">
          <b>Not configured yet.</b> Set <code className="font-mono">OPENROUTER_API_KEY</code> in
          your <code className="font-mono">.env.local</code> and restart. Free keys at{" "}
          <a
            className="underline"
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
          >
            openrouter.ai/keys
          </a>
          .
        </div>
      )}

      <div ref={scroll} className="min-h-[420px] max-h-[70vh] overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Sparkles className="w-6 h-6 mx-auto text-[color:var(--brand-500)]" />
            <p className="text-sm font-semibold mt-2">Try one of these</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs rounded-full border border-border bg-card px-3 py-1.5 hover:border-[color:var(--brand-500)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="flex gap-3">
            <div
              className={
                "w-7 h-7 rounded-full grid place-items-center shrink-0 " +
                (m.role === "user"
                  ? "bg-muted text-foreground"
                  : "bg-[color:var(--brand-50)] text-[color:var(--brand-700)]")
              }
            >
              {m.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
              {m.role === "assistant" && (
                <ul className="mt-2 space-y-1.5">
                  {(m.actions ?? []).length === 0 ? (
                    <li className="text-[11px] rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground px-2.5 py-1.5">
                      No workspace actions were run for this reply. If you expected the model to
                      create or list something, retry with a more specific instruction (e.g.
                      &quot;Create a URL monitor for example.com every 60 seconds&quot;).
                    </li>
                  ) : (
                    (m.actions ?? []).map((a, j) => (
                      <li
                        key={j}
                        className={
                          "text-xs rounded-md border px-2.5 py-1.5 " +
                          (a.ok
                            ? "border-[color:var(--status-up)]/40 bg-[color:var(--status-up)]/10 text-[color:var(--status-up)]"
                            : "border-[color:var(--status-down)]/40 bg-[color:var(--status-down)]/10 text-[color:var(--status-down)]")
                        }
                      >
                        <span className="font-mono font-semibold">{a.tool}</span> · {a.message}
                      </li>
                    ))
                  )}
                </ul>
              )}
              {m.model && (
                <div className="text-[10px] text-muted-foreground mt-1">via {m.model}</div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 items-center text-sm text-muted-foreground">
            <div className="w-7 h-7 rounded-full grid place-items-center bg-[color:var(--brand-50)] text-[color:var(--brand-700)]">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <Loader2 className="w-4 h-4 animate-spin" /> thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me to create a monitor, list your monitors, make a status page…"
          className="flex-1 h-10 rounded-md border border-border bg-card px-3 text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] disabled:opacity-60 text-white text-sm font-semibold"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send
        </button>
      </form>
    </div>
  )
}
