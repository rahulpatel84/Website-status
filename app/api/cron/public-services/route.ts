import { NextResponse } from "next/server"
import {
  listDuePublicServices,
  publicHistoryStorageMode,
  recordPublicServiceChecks,
} from "@/lib/public-service-history"
import {
  getPublicServices,
  probePublicService,
} from "@/lib/public-service-monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function ipFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return request.headers.get("x-real-ip") || ""
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    const ip = ipFromRequest(request)
    return !ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("127.")
  }
  return request.headers.get("authorization") === `Bearer ${secret}`
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback
}

async function handler(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Prefer the new seconds env; fall back to legacy minutes env for compat.
  const intervalSeconds = resolveIntervalSeconds()
  // Cap batch size high enough to comfortably handle the full 100-site catalog
  // in a single invocation.
  const batchSize = positiveInteger(process.env.PUBLIC_SERVICE_BATCH_SIZE, 150, 500)
  const services = getPublicServices()

  try {
    const dueSlugs = await listDuePublicServices(
      services.map((service) => service.id),
      intervalSeconds,
      batchSize,
    )
    const dueServices = dueSlugs
      .map((slug) => services.find((service) => service.id === slug))
      .filter((service): service is NonNullable<typeof service> => Boolean(service))

    // Parallel HEAD requests keep the worker comfortably inside a serverless
    // execution window. The database write is one batched operation.
    const checks = await Promise.all(dueServices.map(probePublicService))
    await recordPublicServiceChecks(checks)

    return NextResponse.json({
      catalogSize: services.length,
      checked: checks.length,
      up: checks.filter((check) => check.status === "up").length,
      down: checks.filter((check) => check.status === "down").length,
      intervalSeconds,
      storage: publicHistoryStorageMode(),
    })
  } catch (error) {
    console.error("Public service cron failed", error)
    return NextResponse.json({ error: "Public service cron failed" }, { status: 500 })
  }
}

function resolveIntervalSeconds(): number {
  const seconds = Number.parseInt(process.env.PUBLIC_SERVICE_CHECK_INTERVAL_SECONDS ?? "", 10)
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 3600)
  // Legacy minutes env (kept for backwards compat)
  const minutes = Number.parseInt(process.env.PUBLIC_SERVICE_CHECK_INTERVAL_MINUTES ?? "", 10)
  if (Number.isFinite(minutes) && minutes > 0) return Math.min(minutes, 60) * 60
  return 30 // default: 30 seconds
}

export const GET = handler
export const POST = handler

