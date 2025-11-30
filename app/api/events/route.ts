import { NextRequest } from "next/server"
import { outageEvents } from "@/lib/events"

export const runtime = "nodejs"

export async function GET(_request: NextRequest) {
  const encoder = new TextEncoder()

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

      // Initial ping to open the stream
      send("ping", { ok: true })

      // Keep references so we can clean up in cancel()
      // @ts-ignore - capture in outer scope of this underlying source
      ;(this as any)._onReport = (payload: any) => send("outage-reported", payload)
      outageEvents.on("outage-reported", (this as any)._onReport)

      // @ts-ignore
      ;(this as any)._keepAlive = setInterval(() => send("ping", { ok: true }), 25000)
    },
    cancel() {
      // @ts-ignore
      const onReport = (this as any)._onReport
      if (onReport) outageEvents.off("outage-reported", onReport)
      // @ts-ignore
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


