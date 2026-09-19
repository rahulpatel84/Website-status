import { NextResponse } from "next/server"
import { createReadStream, existsSync } from "node:fs"
import path from "node:path"
import { PassThrough } from "node:stream"
import archiver from "archiver"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getDatabase } from "@/lib/database"

interface ShotRow {
  id: number
  path: string
  taken_at: string
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_r: Request, { params }: { params: { id: string } }) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)
  const db = getDatabase()
  const monitor = db
    .prepare("SELECT id, name FROM monitors WHERE id = ? AND workspace_id = ?")
    .get(params.id, ws.id) as { id: string; name: string } | undefined
  if (!monitor) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const shots = db
    .prepare(
      "SELECT id, path, taken_at FROM probe_screenshots WHERE monitor_id = ? ORDER BY taken_at DESC",
    )
    .all(monitor.id) as ShotRow[]

  if (shots.length === 0) {
    return NextResponse.json({ error: "No screenshots to download" }, { status: 404 })
  }

  const pass = new PassThrough()
  const archive = archiver("zip", { zlib: { level: 6 } })
  archive.on("warning", (err) => console.warn("[zip] warning", err))
  archive.on("error", (err) => {
    console.error("[zip] error", err)
    pass.destroy(err)
  })
  archive.pipe(pass)

  for (const s of shots) {
    const abs = path.join(process.cwd(), "public", s.path.replace(/^\//, ""))
    if (!existsSync(abs)) continue
    const stamp = new Date(s.taken_at + "Z").toISOString().replace(/[:.]/g, "-")
    archive.append(createReadStream(abs), { name: `${stamp}-${path.basename(s.path)}` })
  }

  // Include a small manifest so the recipient knows what they're looking at.
  const manifest = shots
    .map((s) => `${s.id}\t${s.taken_at}\t${s.path}`)
    .join("\n")
  archive.append(
    `# ${monitor.name} — ${shots.length} browser probe screenshots\n# id\ttaken_at\tpath\n${manifest}\n`,
    { name: "manifest.txt" },
  )

  archive.finalize()

  const safeName = monitor.name.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 40) || monitor.id
  return new NextResponse(pass as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}-screenshots.zip"`,
      "Cache-Control": "no-store",
    },
  })
}
