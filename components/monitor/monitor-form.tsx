"use client"

import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export type MonitorType =
  | "url"
  | "api"
  | "port"
  | "ssl"
  | "dns"
  | "heartbeat"
  | "form"
  | "security-headers"
  | "ssl-grade"
  | "content-hash"

export const MONITOR_TYPES: {
  type: MonitorType
  title: string
  description: string
  targetPlaceholder: string
  targetLabel: string
}[] = [
  {
    type: "url",
    title: "Website / URL",
    description: "HTTP GET · expect 2xx status & optional keyword",
    targetPlaceholder: "https://your-site.com",
    targetLabel: "URL to check",
  },
  {
    type: "form",
    title: "Form loads correctly",
    description: "Headless browser · CSS selector must appear",
    targetPlaceholder: "https://your-site.com/checkout",
    targetLabel: "Page URL",
  },
  {
    type: "api",
    title: "API endpoint",
    description: "GET/POST · assert status + JSON path/value",
    targetPlaceholder: "https://api.example.com/health",
    targetLabel: "API endpoint",
  },
  {
    type: "heartbeat",
    title: "Cron heartbeat",
    description: "You POST to a URL — we alert if it stops",
    targetPlaceholder: "nightly-backup",
    targetLabel: "Identifier (any label)",
  },
  {
    type: "port",
    title: "TCP port",
    description: "DB, SSH, custom protocol",
    targetPlaceholder: "db.example.com:5432",
    targetLabel: "host:port",
  },
  {
    type: "ssl",
    title: "SSL certificate",
    description: "Alert N days before expiry",
    targetPlaceholder: "api.example.com",
    targetLabel: "Hostname",
  },
  {
    type: "dns",
    title: "DNS record",
    description: "Resolve and assert record value",
    targetPlaceholder: "example.com",
    targetLabel: "Hostname",
  },
  {
    type: "security-headers",
    title: "Security headers grade",
    description: "HSTS, CSP, X-Frame-Options, more — Mozilla Observatory rubric",
    targetPlaceholder: "https://your-site.com",
    targetLabel: "URL to grade",
  },
  {
    type: "ssl-grade",
    title: "SSL/TLS grade",
    description: "Protocol, cipher, cert chain, days-to-expiry",
    targetPlaceholder: "api.your-site.com",
    targetLabel: "Hostname",
  },
  {
    type: "content-hash",
    title: "Content change / defacement",
    description: "SHA-256 of stripped page — alert on unexpected change",
    targetPlaceholder: "https://your-site.com",
    targetLabel: "URL to watch",
  },
]

export function TypeTile({
  type,
  title,
  description,
  selected,
  onClick,
}: {
  type: MonitorType
  title: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-xl border p-4 transition-all bg-card",
        selected
          ? "border-[color:var(--brand-500)] ring-2 ring-[color:var(--brand-500)]/20"
          : "border-border hover:border-[color:var(--brand-200)]",
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {type}
      </div>
      <div className="font-semibold text-sm mt-1">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{description}</div>
    </button>
  )
}

export const ASSERTION_KINDS = ["status_code", "body", "response_ms", "header"] as const
export const ASSERTION_OPS = ["eq", "ne", "lt", "gt", "contains"] as const

export type AssertionKind = (typeof ASSERTION_KINDS)[number]
export type AssertionOp = (typeof ASSERTION_OPS)[number]

const KIND_LABEL: Record<AssertionKind, string> = {
  status_code: "HTTP status",
  body: "Response body",
  response_ms: "Response time (ms)",
  header: "Header value",
}

const OP_LABEL: Record<AssertionOp, string> = {
  eq: "equals",
  ne: "not equals",
  lt: "<",
  gt: ">",
  contains: "contains",
}

export interface AssertionInput {
  kind: AssertionKind
  op: AssertionOp
  value: string
}

export function AssertionRow({
  assertion,
  onChange,
  onRemove,
}: {
  assertion: AssertionInput
  onChange: (a: AssertionInput) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        value={assertion.kind}
        onChange={(e) => onChange({ ...assertion, kind: e.target.value as AssertionKind })}
      >
        {ASSERTION_KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        value={assertion.op}
        onChange={(e) => onChange({ ...assertion, op: e.target.value as AssertionOp })}
      >
        {ASSERTION_OPS.map((o) => (
          <option key={o} value={o}>
            {OP_LABEL[o]}
          </option>
        ))}
      </select>
      <input
        className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        placeholder="value"
        value={assertion.value}
        onChange={(e) => onChange({ ...assertion, value: e.target.value })}
      />
      <button
        type="button"
        onClick={onRemove}
        className="h-9 w-9 grid place-items-center rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-muted"
        aria-label="Remove assertion"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
