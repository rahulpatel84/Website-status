import { type NextRequest, NextResponse } from "next/server"
import { insertOutageReport } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companySlug, issueType } = body

    if (!companySlug || !issueType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get user IP and location info
    const userIP =
      request.ip ||
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown"

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
        geoResponse = await fetch(`https://ipapi.co/${userIP}/json/`, {
          timeout: 3000,
        })
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
          geoResponse = await fetch(`http://ip-api.com/json/${userIP}`, {
            timeout: 3000,
          })
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

    // Insert the outage report
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

    const result = await insertOutageReport(report)

    return NextResponse.json({
      success: true,
      reportId: result.lastInsertRowid,
    })
  } catch (error) {
    console.error("Error reporting outage:", error)
    return NextResponse.json({ error: "Failed to report outage" }, { status: 500 })
  }
}
