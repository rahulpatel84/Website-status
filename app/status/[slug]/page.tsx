import { notFound } from "next/navigation"
import { getDatabase } from "@/lib/database"

interface Page {
  id: string
  slug: string
  name: string
  accent_color: string
  logo_url: string | null
  visibility: string
}

interface Component {
  id: string
  monitor_id: string
  monitor_name: string
  monitor_target: string
  current_status: string
  group_name: string
  display_name: string | null
}

interface Incident {
  id: string
  monitor_id: string
  monitor_name: string
  started_at: string
  resolved_at: string | null
  layer_isolated: string | null
  cause: string | null
  severity: string
}

export default async function PublicStatusPage({
  params,
}: {
  params: { slug: string }
}) {
  const db = getDatabase()
  const page = db
    .prepare("SELECT id, slug, name, accent_color, logo_url, visibility FROM status_pages WHERE slug = ?")
    .get(params.slug) as Page | undefined
  if (!page) notFound()

  const components = db
    .prepare(
      `SELECT spc.id, spc.monitor_id, spc.group_name, spc.display_name,
              m.name AS monitor_name, m.target AS monitor_target, m.current_status
       FROM status_page_components spc
       JOIN monitors m ON m.id = spc.monitor_id
       WHERE spc.page_id = ?
       ORDER BY spc.group_name, spc.sort_order`,
    )
    .all(page.id) as Component[]

  const groups = new Map<string, Component[]>()
  for (const c of components) {
    if (!groups.has(c.group_name)) groups.set(c.group_name, [])
    groups.get(c.group_name)!.push(c)
  }

  const incidents = db
    .prepare(
      `SELECT i.id, i.monitor_id, m.name AS monitor_name, i.started_at, i.resolved_at,
              i.layer_isolated, i.cause, i.severity
       FROM incidents i
       JOIN monitors m ON m.id = i.monitor_id
       JOIN status_page_components spc ON spc.monitor_id = i.monitor_id
       WHERE spc.page_id = ?
       ORDER BY i.started_at DESC
       LIMIT 10`,
    )
    .all(page.id) as Incident[]

  const downCount = components.filter((c) => c.current_status === "down").length
  const degradedCount = components.filter((c) => c.current_status === "degraded").length
  const allUp = downCount === 0 && degradedCount === 0

  const brand = page.accent_color || "#F97316"
  const style = { ["--sp-accent" as any]: brand } as React.CSSProperties

  return (
    <div className="min-h-screen bg-background" style={style}>
      <header className="border-b border-border bg-white">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-md grid place-items-center text-white text-xs font-bold"
              style={{ background: brand }}
            >
              {page.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-base tracking-tight">
                {page.name} <span className="text-muted-foreground font-medium">status</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>Live</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <section
          className={
            "flex items-center gap-4 p-5 rounded-xl border " +
            (allUp
              ? "border-[color:var(--status-up)]/30 bg-[color:var(--status-up)]/10"
              : downCount > 0
                ? "border-[color:var(--status-down)]/30 bg-[color:var(--status-down)]/10"
                : "border-[color:var(--status-degraded)]/30 bg-[color:var(--status-degraded)]/10")
          }
        >
          <div
            className={
              "w-10 h-10 rounded-full grid place-items-center text-white font-bold " +
              (allUp
                ? "bg-[color:var(--status-up)]"
                : downCount > 0
                  ? "bg-[color:var(--status-down)]"
                  : "bg-[color:var(--status-degraded)]")
            }
          >
            {allUp ? "✓" : "!"}
          </div>
          <div>
            <h1 className="font-bold text-lg">
              {allUp
                ? "All systems operational"
                : downCount > 0
                  ? `${downCount} service${downCount > 1 ? "s" : ""} experiencing an outage`
                  : `${degradedCount} service${degradedCount > 1 ? "s" : ""} degraded`}
            </h1>
            <p className="text-sm text-muted-foreground">
              Last updated {new Date().toLocaleString()}
            </p>
          </div>
        </section>

        {Array.from(groups.entries()).map(([group, items]) => (
          <section key={group} className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold text-sm mb-3">{group}</h2>
            <ul className="space-y-2">
              {items.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 border-b border-border last:border-b-0 pb-2 last:pb-0"
                >
                  <span
                    className={
                      "w-2 h-2 rounded-full " +
                      (c.current_status === "up"
                        ? "bg-[color:var(--status-up)]"
                        : c.current_status === "down"
                          ? "bg-[color:var(--status-down)]"
                          : "bg-[color:var(--status-degraded)]")
                    }
                  />
                  <span className="text-sm flex-1">{c.display_name || c.monitor_name}</span>
                  <span
                    className={
                      "text-xs font-semibold px-2 py-0.5 rounded-full border " +
                      (c.current_status === "up"
                        ? "text-[color:var(--status-up)] border-[color:var(--status-up)]/30 bg-[color:var(--status-up)]/10"
                        : c.current_status === "down"
                          ? "text-[color:var(--status-down)] border-[color:var(--status-down)]/40 bg-[color:var(--status-down)]/10"
                          : "text-[color:var(--status-degraded)] border-[color:var(--status-degraded)]/40 bg-[color:var(--status-degraded)]/10")
                    }
                  >
                    {c.current_status === "up"
                      ? "Operational"
                      : c.current_status === "down"
                        ? "Down"
                        : c.current_status === "degraded"
                          ? "Degraded"
                          : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {groups.size === 0 && (
          <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No components yet. The workspace owner can add monitors from the builder.
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-sm mb-3">Recent incidents</h2>
          {incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents in the last 90 days.</p>
          ) : (
            <ul className="space-y-3">
              {incidents.map((i) => (
                <li key={i.id} className="border-b border-border last:border-b-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={
                        "text-xs font-semibold px-2 py-0.5 rounded-full border " +
                        (i.resolved_at
                          ? "text-[color:var(--status-up)] border-[color:var(--status-up)]/30 bg-[color:var(--status-up)]/10"
                          : "text-[color:var(--status-down)] border-[color:var(--status-down)]/40 bg-[color:var(--status-down)]/10")
                      }
                    >
                      {i.resolved_at ? "Resolved" : "Investigating"}
                    </span>
                    <span className="text-sm font-semibold">
                      {i.monitor_name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(i.started_at + "Z").toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {i.cause || "Automated detection triggered."}
                    {i.layer_isolated && ` Layer: ${i.layer_isolated}.`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="text-center text-xs text-muted-foreground py-6">
          Powered by <a href="/landing" className="hover:text-foreground">status.watch</a>
        </footer>
      </main>
    </div>
  )
}
