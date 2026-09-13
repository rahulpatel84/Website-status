import { NextResponse } from "next/server"
import { hasPublicServiceStatus } from "@/lib/public-service-history"
import {
  checkAndRecordPublicService,
  getPublicService,
} from "@/lib/public-service-monitoring"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 15

export async function POST(request: Request) {
  let serviceSlug = ""
  try {
    const body = (await request.json()) as { service?: unknown }
    serviceSlug = typeof body.service === "string" ? body.service.trim() : ""
  } catch {
    return NextResponse.json({ error: "A JSON body is required" }, { status: 400 })
  }

  if (!getPublicService(serviceSlug)) {
    return NextResponse.json({ error: "Unknown public service" }, { status: 404 })
  }

  try {
    // This endpoint only seeds a service that has never been checked. Ongoing
    // monitoring belongs to the cron worker, avoiding one probe per visitor.
    if (await hasPublicServiceStatus(serviceSlug)) {
      return NextResponse.json({ seeded: false, reason: "already-monitored" })
    }
    const check = await checkAndRecordPublicService(serviceSlug)
    return NextResponse.json({ seeded: true, check })
  } catch (error) {
    console.error("Failed to seed public service history", error)
    return NextResponse.json({ error: "Failed to check service" }, { status: 500 })
  }
}

