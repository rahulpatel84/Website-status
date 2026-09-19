import websitesData from "@/data/websites.json"
import {
  recordPublicServiceChecks,
  type PublicServiceCheck,
} from "@/lib/public-service-history"

export interface PublicServiceSocials {
  twitter?: string
  linkedin?: string
  github?: string
  facebook?: string
  instagram?: string
  youtube?: string
}

export interface PublicServiceDefinition {
  id: string
  name: string
  url: string
  category: string
  description?: string
  about?: string
  founded?: string
  headquarters?: string
  socials?: PublicServiceSocials
}

const services = websitesData.websites as PublicServiceDefinition[]
const servicesBySlug = new Map(services.map((service) => [service.id, service]))

export function getPublicServices(): PublicServiceDefinition[] {
  return services
}

export function getPublicService(serviceSlug: string): PublicServiceDefinition | null {
  return servicesBySlug.get(serviceSlug) ?? null
}

export async function probePublicService(
  service: PublicServiceDefinition,
): Promise<PublicServiceCheck> {
  const startedAt = Date.now()
  let response: Response | null = null

  try {
    response = await fetch(service.url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      headers: {
        "User-Agent": "status.watch-public-monitor/1.0 (+https://status.watch)",
      },
    })

    // A 4xx often means the vendor blocks automated HEAD requests, while the
    // service itself is reachable. Only server errors count as unavailable.
    const isUp = response.status >= 200 && response.status < 500
    return {
      serviceSlug: service.id,
      status: isUp ? "up" : "down",
      responseMs: Date.now() - startedAt,
      httpStatus: response.status,
      checkedAt: new Date().toISOString(),
      error: isUp ? null : `HTTP ${response.status} ${response.statusText}`.trim(),
    }
  } catch (error) {
    return {
      serviceSlug: service.id,
      status: "down",
      responseMs: Date.now() - startedAt,
      httpStatus: null,
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message.slice(0, 500) : "Network error",
    }
  } finally {
    // We only need headers. Explicitly release any body/connection held by a
    // non-compliant server that returned a body to HEAD.
    await response?.body?.cancel().catch(() => undefined)
  }
}

export async function checkAndRecordPublicService(serviceSlug: string) {
  const service = getPublicService(serviceSlug)
  if (!service) throw new Error("Public service not found")
  const check = await probePublicService(service)
  await recordPublicServiceChecks([check])
  return check
}

