import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  const rows = db
    .prepare(
      "SELECT id, slug, name, accent_color, visibility, custom_domain, created_at FROM status_pages WHERE workspace_id = ? ORDER BY created_at DESC",
    )
    .all(ws.id)
  return NextResponse.json({ pages: rows })
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const body = await request.json().catch(() => ({}))
  const name = (body.name || "").trim() || "New status page"
  const db = getDatabase()

  const base = slugify(name)
  let slug = base
  let n = 1
  while (db.prepare("SELECT 1 FROM status_pages WHERE slug = ?").get(slug)) {
    slug = `${base}-${n++}`
  }
  const id = "sp_" + randomUUID().slice(0, 12)
  db.prepare(
    "INSERT INTO status_pages (id, workspace_id, slug, name, accent_color, visibility) VALUES (?, ?, ?, ?, '#F97316', 'public')",
  ).run(id, ws.id, slug, name)
  return NextResponse.json({ page: { id, slug, name } })
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "page"
  )
}
