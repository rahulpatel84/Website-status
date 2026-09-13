"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { Copy, Loader2, Send, Trash2, RefreshCw, MessageCircle } from "lucide-react"

interface PairingResp {
  code: string
  expiresAt: string
  botUsername: string
}

interface Channel {
  id: string
  kind: string
  label: string
  config: string
  is_verified: number
  created_at: string
}

export default function TelegramConnectPage() {
  const [pairing, setPairing] = useState<PairingResp | null>(null)
  const [pairingLoading, setPairingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const knownChatIdsRef = useRef<Set<string> | null>(null)

  const loadChannels = useCallback(async () => {
    try {
      const r = await fetch("/api/channels")
      const j = await r.json()
      const tg: Channel[] = (j.channels ?? []).filter(
        (c: Channel) => c.kind === "telegram",
      )
      setChannels(tg)
      return tg
    } catch {
      return [] as Channel[]
    }
  }, [])

  const generateCode = useCallback(async () => {
    setPairingLoading(true)
    setError(null)
    try {
      const r = await fetch("/api/telegram/pair", { method: "POST" })
      const d = await r.json()
      if (d.code) {
        setPairing(d)
      } else {
        setError(d.error || "failed")
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setPairingLoading(false)
    }
  }, [])

  useEffect(() => {
    loadChannels()
    generateCode()
  }, [loadChannels, generateCode])

  useEffect(() => {
    if (!pairing) return
    if (knownChatIdsRef.current === null) {
      knownChatIdsRef.current = new Set(channels.map(chatIdFrom).filter(Boolean))
    }
    const int = setInterval(async () => {
      const tg = await loadChannels()
      const currentIds = new Set(tg.map(chatIdFrom).filter(Boolean))
      const known = knownChatIdsRef.current ?? new Set()
      const newlyLinked = [...currentIds].some((id) => !known.has(id))
      knownChatIdsRef.current = currentIds
      if (newlyLinked) generateCode()
    }, 5000)
    return () => clearInterval(int)
  }, [pairing, channels, loadChannels, generateCode])

  const botUsername = pairing?.botUsername || "statuswatch_bot"

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground">
          <Link href="/app/notifications" className="hover:text-foreground">
            Notifications
          </Link>{" "}
          / Telegram
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
          Connect Telegram
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Receive alerts in a personal chat or group. Link as many chats as you want.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-[color:var(--status-down)]/40 bg-[color:var(--status-down)]/10 text-[color:var(--status-down)] px-4 py-3 text-sm mb-4">
          {error === "not-configured"
            ? "Telegram bot not yet configured on the server. Set TELEGRAM_BOT_TOKEN in .env.local to enable pairing."
            : error}
        </div>
      )}

      <LinkedChatsPanel
        channels={channels}
        onChanged={loadChannels}
      />

      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4">
        <div className="space-y-4">
          <Step
            number={1}
            title={channels.length ? "Link another chat" : "Open the bot in Telegram"}
          >
            <p className="text-sm text-muted-foreground mb-3">
              Tap the button below or search{" "}
              <b>@{botUsername}</b> in Telegram. Send{" "}
              <code className="font-mono text-xs">/start</code>. To alert a
              team, add the bot to a group chat instead.
            </p>
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
            >
              Open @{botUsername} →
            </a>
          </Step>

          <Step number={2} title="Send this pairing code">
            <p className="text-sm text-muted-foreground mb-3">
              Paste it in the bot chat within 10 minutes. Each code links one chat.
            </p>
            {pairing ? (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="font-mono text-xl tracking-[0.4em] px-4 py-3 border border-dashed border-border rounded-lg bg-background">
                  {pairing.code}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pairing.code)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input text-sm font-medium"
                >
                  <Copy className="w-3.5 h-3.5" /> {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={generateCode}
                  disabled={pairingLoading}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input text-sm font-medium text-muted-foreground hover:text-foreground"
                  title="Generate a new code"
                >
                  <RefreshCw
                    className={
                      "w-3.5 h-3.5 " + (pairingLoading ? "animate-spin" : "")
                    }
                  />
                  New code
                </button>
              </div>
            ) : error ? (
              <p className="text-xs text-muted-foreground">
                A pairing code will appear here once the bot is configured.
              </p>
            ) : (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </Step>

          <Step number={3} title="Wait for confirmation">
            <div
              className={
                "px-3 py-3 rounded-md flex items-center gap-3 " +
                (channels.length
                  ? "bg-[color:var(--status-up)]/10 border border-[color:var(--status-up)]/30 text-[color:var(--status-up)]"
                  : "bg-muted border border-border")
              }
            >
              <div className="w-6 h-6 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)] text-xs font-bold grid place-items-center">
                SW
              </div>
              <div className="flex-1 min-w-0">
                {channels.length ? (
                  <div className="text-sm font-semibold">
                    {channels.length === 1
                      ? "Telegram linked! Alerts will arrive in your chat."
                      : `${channels.length} chats linked. Alerts will arrive in each.`}
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground">
                      Waiting for you to send the code…
                    </div>
                    <div className="text-sm">
                      Once paired, this page updates automatically.
                    </div>
                  </>
                )}
              </div>
              <div
                className={
                  "w-2 h-2 rounded-full " +
                  (channels.length
                    ? "bg-[color:var(--status-up)]"
                    : "bg-[color:var(--status-degraded)]")
                }
              />
            </div>
          </Step>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">Sample alert</h3>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">
                @{botUsername} · now
              </div>
              <div className="font-semibold text-sm text-[color:var(--status-down)] mt-1">
                api.acme.io is DOWN
              </div>
              <p className="text-xs mt-1">
                HTTP 503 from origin. Layer isolated: <b>upstream API</b>.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function chatIdFrom(c: Channel): string {
  try {
    const cfg = typeof c.config === "string" ? JSON.parse(c.config) : c.config
    return String(cfg?.chat_id ?? "")
  } catch {
    return ""
  }
}

function LinkedChatsPanel({
  channels,
  onChanged,
}: {
  channels: Channel[]
  onChanged: () => Promise<Channel[]>
}) {
  if (!channels.length) return null
  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">
          Linked chats ({channels.length})
        </h2>
        <p className="text-xs text-muted-foreground">
          Alerts fan out to every linked chat.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {channels.map((c) => (
          <ChannelRow key={c.id} channel={c} onChanged={onChanged} />
        ))}
      </ul>
    </div>
  )
}

function ChannelRow({
  channel,
  onChanged,
}: {
  channel: Channel
  onChanged: () => Promise<Channel[]>
}) {
  const [busy, setBusy] = useState<"idle" | "test" | "delete">("idle")
  const [testState, setTestState] = useState<"idle" | "ok" | "err">("idle")
  const chatId = chatIdFrom(channel)

  async function test() {
    setBusy("test")
    setTestState("idle")
    try {
      const r = await fetch(`/api/channels/${channel.id}/test`, { method: "POST" })
      setTestState(r.ok ? "ok" : "err")
    } catch {
      setTestState("err")
    } finally {
      setBusy("idle")
      setTimeout(() => setTestState("idle"), 2500)
    }
  }

  async function del() {
    if (!confirm(`Disconnect ${channel.label}? Alerts will stop reaching this chat.`)) {
      return
    }
    setBusy("delete")
    try {
      await fetch(`/api/channels/${channel.id}`, { method: "DELETE" })
      await onChanged()
    } finally {
      setBusy("idle")
    }
  }

  return (
    <li className="py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)] grid place-items-center shrink-0">
        <MessageCircle className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{channel.label}</div>
        <div className="text-xs text-muted-foreground truncate">
          chat_id {chatId || "—"} · linked {new Date(channel.created_at).toLocaleDateString()}
        </div>
      </div>
      <button
        onClick={test}
        disabled={busy !== "idle"}
        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-input text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
      >
        <Send className="w-3 h-3" />
        {busy === "test"
          ? "Sending…"
          : testState === "ok"
            ? "Sent"
            : testState === "err"
              ? "Failed"
              : "Test"}
      </button>
      <button
        onClick={del}
        disabled={busy !== "idle"}
        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-input text-xs text-muted-foreground hover:text-[color:var(--status-down)] disabled:opacity-60"
      >
        <Trash2 className="w-3 h-3" />
        {busy === "delete" ? "…" : "Disconnect"}
      </button>
    </li>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-700)]">
          Step {number}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  )
}
