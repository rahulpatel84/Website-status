import { type NextRequest, NextResponse } from "next/server"
import { insertOutageReport } from "@/lib/database"
import { outageEvents } from "@/lib/events"
import { ipHash } from "@/lib/ip-hash"
import { logger, createRequestId } from "@/lib/logger"
import { recordActivity } from "@/lib/activity-log"
import { logEvent } from "@/lib/logs"

export async function POST(request: NextRequest) {
  const requestId = createRequestId()
  try {
    const body = await request.json()
    const { companySlug, issueType, clientTimestamp, clientIP } = body

    // LOG: API received the request
    const serverTime = new Date()
    console.log(`🟡 API RECEIVED OUTAGE REPORT:`)
    console.log(`Company: ${companySlug}`)
    console.log(`Issue Type: ${issueType}`)
    console.log(`Client Timestamp: ${clientTimestamp}`)
    console.log(`Server Time: ${serverTime.toLocaleString()} (${serverTime.toISOString()})`)

    if (!companySlug || !issueType) {
      console.log(`❌ MISSING REQUIRED FIELDS`)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get user IP and location info
    const headerIP =
      request.ip ||
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown"

    // Prefer client-provided public IP when available and plausible
    const ipCandidate = (clientIP?.toString() || "").trim()
    const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}$|^[a-fA-F0-9:]+$/ // IPv4 or IPv6 (basic)
    const userIP = ipRegex.test(ipCandidate) ? ipCandidate : headerIP

    console.log(`🌐 IPs -> clientIP: ${ipCandidate || 'n/a'}, headerIP: ${headerIP}, using: ${userIP}`)

    const userAgent = request.headers.get("user-agent") || "unknown"

    // Get geolocation data from IP (using a free service)
    let locationData = {
      city: null,
      state: null,
      country: null,
      latitude: null,
      longitude: null,
    }

    try {
      let geoResponse

      // Try ipapi.co first (most reliable)
      try {
        geoResponse = await fetch(`https://ipapi.co/${userIP}/json/`)
        if (geoResponse.ok) {
          const geoData = await geoResponse.json()
          if (geoData.latitude && geoData.longitude) {
            locationData = {
              city: geoData.city,
              state: geoData.region,
              country: geoData.country_name,
              latitude: geoData.latitude,
              longitude: geoData.longitude,
            }
          }
        }
      } catch (error) {
        console.log("ipapi.co failed, trying fallback...")
      }

      // Fallback to ip-api.com if ipapi.co fails
      if (!locationData.latitude) {
        try {
          geoResponse = await fetch(`http://ip-api.com/json/${userIP}`)
          if (geoResponse.ok) {
            const geoData = await geoResponse.json()
            if (geoData.status === "success") {
              locationData = {
                city: geoData.city,
                state: geoData.regionName,
                country: geoData.country,
                latitude: geoData.lat,
                longitude: geoData.lon,
              }
            }
          }
        } catch (error) {
          console.log("ip-api.com also failed")
        }
      }
    } catch (geoError) {
      console.log("All geolocation services failed:", geoError)
      // Continue without location data
    }

    // Optional: refine city/town using reverse geocoding if we have lat/lon
    try {
      if (locationData.latitude && locationData.longitude) {
        const rev = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${locationData.latitude}&lon=${locationData.longitude}`,
          { headers: { "User-Agent": "website-status/1.0" } }
        )
        if (rev.ok) {
          const r = await rev.json()
          const a = r?.address || {}
          // Prefer proper city for city-wise aggregation; fallback to town/village if city is unavailable
          const preferredCity = a.city || a.city_district || a.town || a.village || a.hamlet || a.suburb || a.neighbourhood
          if (preferredCity) {
            locationData.city = preferredCity
          }
          // Prefer more precise state if present
          if (a.state) {
            locationData.state = a.state
          }
        }
      }
    } catch (e) {
      console.log("Reverse geocoding failed", e)
    }

    // Pretty location string for terminal logs
    const locationParts = [locationData.city, locationData.state, locationData.country].filter(Boolean)
    const locationPretty = locationParts.length > 0 ? locationParts.join(", ") : "Unknown location"
    console.log(`📍 Someone submitted outage from ${locationPretty} (IP ${userIP})`)

    // Insert the outage report
    const dbInsertTime = new Date()
    const report = {
      company_slug: companySlug,
      issue_type: issueType,
      user_ip: userIP,
      city: locationData.city,
      state: locationData.state,
      country: locationData.country,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      user_agent: userAgent,
    }

    console.log(`🟢 INSERTING INTO DATABASE:`)
    console.log(`DB Insert Time: ${dbInsertTime.toLocaleString()} (${dbInsertTime.toISOString()})`)
    console.log(`Report Data:`, report)

    const result = await insertOutageReport(report)

    console.log(`✅ DATABASE INSERT RESULT:`, result)
    console.log(`Report ID: ${result.lastInsertRowid}`)

    // Instrumentation only — after the insert succeeded. The raw IP is never
    // logged; only its salted hash.
    const reporterIpHash = ipHash(userIP)
    logger.info("outage reported", {
      requestId,
      companySlug,
      issueType,
      reportId: result.lastInsertRowid,
    })
    recordActivity({
      actorType: "anonymous",
      level: "info",
      event: "outage.reported",
      category: "api",
      targetType: "company",
      targetId: String(companySlug),
      message: `Outage reported for ${companySlug} (${issueType})`,
      metadata: {
        company_slug: companySlug,
        issue_type: issueType,
        city: locationData.city,
        state: locationData.state,
        country: locationData.country,
        report_id: String(result.lastInsertRowid),
      },
      requestId,
      ipHash: reporterIpHash,
    })

    // Emit SSE event for realtime updates
    outageEvents.emit("outage-reported", {
      companySlug,
      issueType,
      city: locationData.city,
      state: locationData.state,
      country: locationData.country,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      created_at: new Date().toISOString(),
    })

    // Raw IP is never logged — only the salted hash from lib/ip-hash.
    logEvent({
      level: "info",
      source: "public",
      event: "public.outage_reported",
      message: `Outage reported for ${companySlug} (${issueType}) from ${locationPretty}`,
      targetType: "outage_report",
      targetId: String(result.lastInsertRowid),
      ipHash: ipHash(userIP),
      metadata: {
        companySlug,
        issueType,
        city: locationData.city,
        state: locationData.state,
        country: locationData.country,
      },
    })

    return NextResponse.json({
      success: true,
      reportId: result.lastInsertRowid,
      serverTime: dbInsertTime.toISOString(),
      clientTime: clientTimestamp,
      location: locationPretty,
      ip: userIP,
    })
  } catch (error) {
    logger.error("outage report failed", {
      requestId,
      error: error instanceof Error ? error.message : "unknown error",
    })
    console.error("Error reporting outage:", error)
    return NextResponse.json({ error: "Failed to report outage" }, { status: 500 })
  }
}
