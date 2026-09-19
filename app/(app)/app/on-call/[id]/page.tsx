import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getDatabase } from "@/lib/database"
import { LayerEditor } from "./layer-editor"

interface ScheduleRow {
  id: string
  workspace_id: string
  name: string
  timezone: string
  created_at: string
}

interface LayerRow {
  id: string
  name: string
  rotation_kind: string
  rotation_days: number
  handoff_time: string
  members: string
  layer_order: number
}

interface MemberRow {
  user_id: string
  role: string
  name: string
  email: string
}

export default async function ScheduleDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { workspace } = await requireAuth()
  const db = getDatabase()

  const schedule = db
    .prepare("SELECT * FROM on_call_schedules WHERE id = ? AND workspace_id = ?")
    .get(params.id, workspace.id) as ScheduleRow | undefined
  if (!schedule) notFound()

  const layers = db
    .prepare(
      "SELECT id, name, rotation_kind, rotation_days, handoff_time, members, layer_order FROM on_call_layers WHERE schedule_id = ? ORDER BY layer_order",
    )
    .all(schedule.id) as LayerRow[]

  const members = db
    .prepare(
      `SELECT wm.user_id, wm.role, u.name, u.email
       FROM workspace_members wm
       JOIN app_users u ON u.id = wm.user_id
       WHERE wm.workspace_id = ?`,
    )
    .all(workspace.id) as MemberRow[]

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground">
          <Link href="/app/on-call" className="hover:text-foreground">
            On-call
          </Link>{" "}
          / {schedule.name}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
          {schedule.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {schedule.timezone} · {layers.length} {layers.length === 1 ? "layer" : "layers"}
        </p>
      </div>

      <LayerEditor scheduleId={schedule.id} layers={layers} members={members} />
    </div>
  )
}
