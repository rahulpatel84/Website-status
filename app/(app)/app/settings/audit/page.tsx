import Link from "next/link"
import { ScrollText } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

interface EventRow {
  id: string
  event: string
  category: string
  level: string
  actor_type: string
  actor_label: string | null
  message: string
  target_type: string | null
  target_id: string | null
  metadata: string | null
  ip_hash: string | null
  request_id: string | null
  created_at: string
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { category?: string; level?: string; q?: string }
}) {
  const { workspace } = await requireAuth()
  const db = getDatabase()

  const where: string[] = ["workspace_id = ?"]
  const args: any[] = [workspace.id]
  if (searchParams.category) {
    where.push("category = ?")
    args.push(searchParams.category)
  }
  if (searchParams.level) {
    where.push("level = ?")
    args.push(searchParams.level)
  }
  if (searchParams.q) {
    where.push("(message LIKE ? OR event LIKE ? OR target_id LIKE ?)")
    const like = `%${searchParams.q}%`
    args.push(like, like, like)
  }

  const rows = db
    .prepare(
      `SELECT id, event, category, level, actor_type, actor_label, message,
              target_type, target_id, metadata, ip_hash, request_id, created_at
       FROM activity_logs
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT 200`,
    )
    .all(...args) as EventRow[]

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground">
          <Link href="/app/settings" className="hover:text-foreground">
            Settings
          </Link>{" "}
          / Audit log
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">Audit log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Immutable append-only log of every meaningful action in your workspace. Retained 1 year.
          Available via API at <code className="font-mono">/api/audit</code> (coming next).
        </p>
      </div>

      <form className="flex items-center gap-2 mb-4">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Search event / message / target…"
          className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        />
        <select
          name="category"
          defaultValue={searchParams.category ?? ""}
          className="h-9 rounded-md border border-input px-3 text-sm"
        >
          <option value="">All categories</option>
          <option value="monitor">monitor</option>
          <option value="incident">incident</option>
          <option value="notification">notification</option>
          <option value="auth">auth</option>
          <option value="api">api</option>
          <option value="comment">comment</option>
          <option value="system">system</option>
        </select>
        <select
          name="level"
          defaultValue={searchParams.level ?? ""}
          className="h-9 rounded-md border border-input px-3 text-sm"
        >
          <option value="">All levels</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
          <option value="debug">debug</option>
        </select>
        <button
          type="submit"
          className="h-9 px-4 rounded-md bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white text-sm font-semibold"
        >
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <ScrollText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No audit events match this filter yet.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">When</th>
                <th className="text-left px-4 py-2 font-semibold">Event</th>
                <th className="text-left px-4 py-2 font-semibold">Level</th>
                <th className="text-left px-4 py-2 font-semibold">Actor</th>
                <th className="text-left px-4 py-2 font-semibold">Target</th>
                <th className="text-left px-4 py-2 font-semibold">Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at + "Z").toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-foreground">{r.event}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border " +
                        (r.level === "error"
                          ? "text-[color:var(--status-down)] border-[color:var(--status-down)]/40 bg-[color:var(--status-down)]/10"
                          : r.level === "warn"
                            ? "text-[color:var(--status-degraded)] border-[color:var(--status-degraded)]/40 bg-[color:var(--status-degraded)]/10"
                            : "text-muted-foreground border-border bg-muted")
                      }
                    >
                      {r.level}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {r.actor_label ?? r.actor_type}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground truncate max-w-[180px]">
                    {r.target_type && r.target_id ? `${r.target_type}:${r.target_id}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[400px]">
                    {r.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
