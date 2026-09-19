import Link from "next/link"
import { BookText, ExternalLink, Plus } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { CreatePageButton } from "./create-button"

interface PageRow {
  id: string
  slug: string
  name: string
  visibility: string
  accent_color: string
}

export default async function StatusPagesListPage() {
  const { workspace } = await requireAuth()
  const db = getDatabase()
  const pages = db
    .prepare(
      "SELECT id, slug, name, visibility, accent_color FROM status_pages WHERE workspace_id = ? ORDER BY created_at DESC",
    )
    .all(workspace.id) as PageRow[]

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Status pages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Custom-branded public pages your users can subscribe to.
          </p>
        </div>
        <CreatePageButton />
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <BookText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No status pages yet. Create one to give customers a live view of your services.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {pages.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-b-0"
            >
              <div
                className="w-10 h-10 rounded-md grid place-items-center text-white text-xs font-bold"
                style={{ background: p.accent_color }}
              >
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{p.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  /status/{p.slug} · {p.visibility}
                </div>
              </div>
              <a
                href={`/status/${p.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-3 h-3" /> View
              </a>
              <Link
                href={`/app/status-pages/${p.id}`}
                className="inline-flex items-center h-8 px-3 rounded-md border border-input text-xs font-semibold"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
