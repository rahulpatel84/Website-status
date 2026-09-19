import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { EditMonitorForm } from "./edit-form"

interface MonitorRow {
  id: string
  workspace_id: string
  name: string
  type: string
  target: string
  method: string
  interval_s: number
  regions: string
  config: string
  is_paused: number
}

export default async function EditMonitorPage({
  params,
}: {
  params: { id: string }
}) {
  const { workspace } = await requireAuth()
  const db = getDatabase()
  const monitor = db
    .prepare("SELECT * FROM monitors WHERE id = ? AND workspace_id = ?")
    .get(params.id, workspace.id) as MonitorRow | undefined
  if (!monitor) notFound()

  let regions: string[] = []
  try {
    regions = JSON.parse(monitor.regions)
  } catch {}
  let config: Record<string, unknown> = {}
  try {
    config = JSON.parse(monitor.config)
  } catch {}

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link
          href={`/app/monitors/${monitor.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to monitor
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit monitor</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono truncate">
          {monitor.type.toUpperCase()} · {monitor.id}
        </p>
      </div>

      <EditMonitorForm
        id={monitor.id}
        initial={{
          name: monitor.name,
          type: monitor.type,
          target: monitor.target,
          interval_s: monitor.interval_s,
          is_paused: Boolean(monitor.is_paused),
          regions,
          config,
        }}
      />
    </div>
  )
}
