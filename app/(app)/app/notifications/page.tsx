import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { Mail, MessageCircle, Hash, Webhook, Plus } from "lucide-react"
import {
  AddChannelForm,
  TestButton,
  DeleteButton,
  CadenceSelect,
} from "./channel-actions"

function parseCadence(config: string): number {
  try {
    const parsed = JSON.parse(config)
    const raw = parsed?.notify_every_min
    if (raw === 0 || raw === "0") return 0
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  } catch {}
  const envRaw = Number(process.env.RENOTIFY_INTERVAL_MIN ?? "30")
  return Number.isFinite(envRaw) && envRaw > 0 ? envRaw : 30
}

interface ChannelRow {
  id: string
  kind: string
  label: string
  config: string
  is_verified: number
  created_at: string
}

const KIND_META = {
  email: {
    icon: Mail,
    title: "Email",
    description: "Delivered via Resend · signed SPF/DKIM",
    placeholder: "you@example.com",
  },
  telegram: {
    icon: MessageCircle,
    title: "Telegram",
    description: "Alerts delivered by @statuswatch_bot",
    placeholder: "",
  },
  slack: {
    icon: Hash,
    title: "Slack",
    description: "Uses Slack's incoming webhook",
    placeholder: "https://hooks.slack.com/services/...",
  },
  webhook: {
    icon: Webhook,
    title: "Webhook",
    description: "Signed POST to your endpoint",
    placeholder: "https://your-endpoint.com/hooks/status",
  },
} as const

export default async function NotificationsPage() {
  const { workspace } = await requireAuth()
  const db = getDatabase()
  const channels = db
    .prepare(
      "SELECT id, kind, label, config, is_verified, created_at FROM notification_channels WHERE workspace_id = ? ORDER BY kind, created_at DESC",
    )
    .all(workspace.id) as ChannelRow[]

  const byKind = new Map<string, ChannelRow[]>()
  ;(["email", "telegram", "slack", "webhook"] as const).forEach((k) => byKind.set(k, []))
  channels.forEach((c) => byKind.get(c.kind)?.push(c))

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Notification channels
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Where alerts get sent. Assign channels per monitor.
        </p>
      </div>

      <div className="space-y-4">
        {(["email", "telegram", "slack", "webhook"] as const).map((kind) => {
          const meta = KIND_META[kind]
          const Icon = meta.icon
          const rows = byKind.get(kind) ?? []
          const connected = rows.length > 0

          return (
            <section key={kind} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-md bg-[color:var(--brand-50)] text-[color:var(--brand-700)] grid place-items-center">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{meta.title}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {meta.description}
                  </p>
                </div>
                <div className="ml-auto">
                  {connected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--status-up)]/30 bg-[color:var(--status-up)]/10 text-[color:var(--status-up)] text-xs font-semibold px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--status-up)]" />
                      {rows.length} connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted text-muted-foreground text-xs font-semibold px-2 py-0.5">
                      Not connected
                    </span>
                  )}
                </div>
              </div>

              {rows.length > 0 && (
                <ul className="space-y-1.5 mb-4">
                  {rows.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm border-t border-border pt-3"
                    >
                      <span className="font-medium truncate max-w-[240px]">{r.label}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        · {new Date(r.created_at + "Z").toLocaleDateString()}
                      </span>
                      <div className="ml-auto flex items-center gap-2 flex-wrap">
                        <CadenceSelect id={r.id} initialValue={parseCadence(r.config)} />
                        <TestButton id={r.id} />
                        <DeleteButton id={r.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {kind === "telegram" ? (
                <Link
                  href="/app/notifications/telegram"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Connect Telegram
                </Link>
              ) : (
                <AddChannelForm kind={kind} placeholder={meta.placeholder} />
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
