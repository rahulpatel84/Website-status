import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { PageEditor } from "./page-editor"

interface PageRow {
  id: string
  workspace_id: string
  slug: string
  name: string
  accent_color: string
  visibility: string
  custom_domain: string | null
}

interface ComponentRow {
  id: string
  monitor_id: string
  monitor_name: string
  monitor_target: string
  current_status: string
  group_name: string
  display_name: string | null
  sort_order: number
}

interface MonitorRow {
  id: string
  name: string
  target: string
  current_status: string
}

export default async function StatusPageBuilder({
  params,
}: {
  params: { id: string }
}) {
  const { workspace } = await requireAuth()
  const db = getDatabase()

  const page = db
    .prepare("SELECT * FROM status_pages WHERE id = ? AND workspace_id = ?")
    .get(params.id, workspace.id) as PageRow | undefined
  if (!page) notFound()

  const components = db
    .prepare(
      `SELECT spc.id, spc.monitor_id, spc.group_name, spc.display_name, spc.sort_order,
              m.name AS monitor_name, m.target AS monitor_target, m.current_status
       FROM status_page_components spc
       JOIN monitors m ON m.id = spc.monitor_id
       WHERE spc.page_id = ?
       ORDER BY spc.sort_order`,
    )
    .all(page.id) as ComponentRow[]

  const monitors = db
    .prepare(
      "SELECT id, name, target, current_status FROM monitors WHERE workspace_id = ? ORDER BY name",
    )
    .all(workspace.id) as MonitorRow[]

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground">
          <Link href="/app/status-pages" className="hover:text-foreground">
            Status pages
          </Link>{" "}
          / {page.name}
        </p>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{page.name}</h1>
          <a
            href={`/status/${page.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="w-3 h-3" /> /status/{page.slug}
          </a>
        </div>
      </div>

      <PageEditor page={page} components={components} monitors={monitors} />
    </div>
  )
}
