import { NextResponse } from "next/server"
import { currentUser, ensureUserAndWorkspace } from "@/lib/auth"
import { getActivityLog } from "@/lib/activity-log"
import { createRequestId, logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  const ws = await ensureUserAndWorkspace(user)

  const requestId = createRequestId()
  const log = getActivityLog(ws.id, params.id)

  if (!log) {
    logger.warn("logs.get.not_found", {
      requestId,
      workspaceId: ws.id,
      id: params.id,
    })
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  logger.info("logs.get", { requestId, workspaceId: ws.id, id: log.id })

  return NextResponse.json({ log })
}
