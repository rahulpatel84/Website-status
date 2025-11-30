import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
  }

  try {
    // Validate URL format
    new URL(url)

    const startTime = Date.now()

    // Make request to the website
    const response = await fetch(url, {
      method: "HEAD", // Use HEAD to minimize data transfer
      signal: AbortSignal.timeout(10000), // 10 second timeout
      headers: {
        "User-Agent": "Website-Status-Checker/1.0",
      },
    })

    const endTime = Date.now()
    const responseTime = endTime - startTime

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      responseTime,
      ok: response.ok,
      url: url,
    })
  } catch (error) {
    const endTime = Date.now()
    const responseTime = endTime - Date.now()

    return NextResponse.json(
      {
        status: 0,
        statusText: "Network Error",
        responseTime,
        ok: false,
        url: url,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
