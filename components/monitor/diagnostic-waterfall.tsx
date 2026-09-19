import { cn } from "@/lib/utils"

export const LAYERS = [
  "dns",
  "tcp",
  "tls",
  "http_head",
  "body_assertion",
  "dependency",
  "runtime",
] as const

export type Layer = (typeof LAYERS)[number]

const LABELS: Record<Layer, string> = {
  dns: "DNS resolution",
  tcp: "TCP connection",
  tls: "TLS handshake",
  http_head: "HTTP HEAD",
  body_assertion: "Body assertion",
  dependency: "Dependency",
  runtime: "Runtime",
}

/**
 * `failedLayer` is the layer key from the most recent failing probe.
 * If null/undefined, all layers render as passing (green).
 * All layers above the failed one are green; the failed one is red; below are muted.
 */
export function DiagnosticWaterfall({
  failedLayer,
  className,
}: {
  failedLayer?: string | null
  className?: string
}) {
  const failedIndex = failedLayer
    ? LAYERS.findIndex((l) => l === failedLayer)
    : -1

  return (
    <div className={cn("space-y-2", className)}>
      {LAYERS.map((layer, idx) => {
        let dotCls = "bg-[color:var(--status-up)]"
        let textCls = "text-foreground"
        let label = "OK"
        if (failedIndex >= 0) {
          if (idx < failedIndex) {
            dotCls = "bg-[color:var(--status-up)]"
            label = "OK"
          } else if (idx === failedIndex) {
            dotCls = "bg-[color:var(--status-down)]"
            textCls = "text-[color:var(--status-down)]"
            label = "Failed"
          } else {
            dotCls = "bg-muted"
            textCls = "text-muted-foreground"
            label = "—"
          }
        }
        return (
          <div key={layer} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", dotCls)} />
              <span className={cn("text-sm", textCls)}>{LABELS[layer]}</span>
            </div>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
