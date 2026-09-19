import { NextRequest } from "next/server"
import { outageEvents } from "@/lib/events"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  // Optional company filter — when supplied, only forward events for that slug.
  const url = new URL(request.url)
  const companyFilter = url.searchParams.get("company")

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: object) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Controller might be closed; ignore
        }
      }

      const matchesCompany = (payload: any) => {
        if (!companyFilter) return true
        return payload && payload.companySlug === companyFilter
      }

      // Initial ping to open the stream
      send("ping", { ok: true })

      // Outage report events (existing)
      ;(this as any)._onReport = (payload: any) => {
        if (matchesCompany(payload)) send("outage-reported", payload)
      }
      outageEvents.on("outage-reported", (this as any)._onReport)

      // Comment events
      ;(this as any)._onCommentNew = (payload: any) => {
        if (matchesCompany(payload)) send("comment.new", payload)
      }
      outageEvents.on("comment.new", (this as any)._onCommentNew)

      ;(this as any)._onCommentVote = (payload: any) => {
        if (matchesCompany(payload)) send("comment.vote", payload)
      }
      outageEvents.on("comment.vote", (this as any)._onCommentVote)

      // @ts-ignore
      ;(this as any)._keepAlive = setInterval(() => send("ping", { ok: true }), 25000)
    },
    cancel() {
      const onReport = (this as any)._onReport
      if (onReport) outageEvents.off("outage-reported", onReport)
      const onCommentNew = (this as any)._onCommentNew
      if (onCommentNew) outageEvents.off("comment.new", onCommentNew)
      const onCommentVote = (this as any)._onCommentVote
      if (onCommentVote) outageEvents.off("comment.vote", onCommentVote)
      const keepAlive: NodeJS.Timeout | undefined = (this as any)._keepAlive
      if (keepAlive) clearInterval(keepAlive)
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
