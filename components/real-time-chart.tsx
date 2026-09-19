"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { RefreshCw, RotateCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Status = "up" | "down"
type HistoryRange = "24h" | "7d" | "30d" | "6m"

interface ChartPoint {
  timestamp: string
  responseTime: number
  status: Status
  formattedTime: string
  uptime?: number
  checks?: number
  downChecks?: number
}

interface StoredHistory {
  bucketMinutes: number
  retentionDays: number
  current: {
    status: Status
    responseTime: number | null
    httpStatus: number | null
    checkedAt: string
    error: string | null
  } | null
  summary: {
    checks: number
    upChecks: number
    downChecks: number
    uptime: number | null
    averageResponseMs: number | null
    maxResponseMs: number | null
    incidents: number
  }
  points: Array<{
    timestamp: string
    responseTime: number
    status: Status
    uptime: number
    checks: number
    downChecks: number
  }>
  incidents: Array<{
    id: string
    startedAt: string
    resolvedAt: string | null
    cause: string | null
    httpStatus: number | null
  }>
}

interface RealTimeChartProps {
  url: string
  name: string
  isActive: boolean
  onToggle: () => void
  serviceSlug?: string
}

const RANGE_OPTIONS: Array<{ value: HistoryRange; label: string }> = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "6m", label: "6 months" },
]

function formatUptime(value: number | null): string {
  if (value === null) return "—"
  if (value === 100) return "100%"
  return `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`
}

function formatPointTime(timestamp: string, range: HistoryRange) {
  const date = new Date(timestamp)
  if (range === "24h") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  if (range === "7d") {
    return date.toLocaleDateString([], { weekday: "short", hour: "2-digit" })
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function formatIncidentDuration(startedAt: string, resolvedAt: string | null) {
  const durationMs = Math.max(
    0,
    new Date(resolvedAt ?? Date.now()).getTime() - new Date(startedAt).getTime(),
  )
  const minutes = Math.floor(durationMs / 60_000)
  if (minutes < 1) return "less than a minute"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export function RealTimeChart({
  url,
  name,
  isActive,
  onToggle: _onToggle,
  serviceSlug,
}: RealTimeChartProps) {
  const [sessionData, setSessionData] = useState<ChartPoint[]>([])
  const [history, setHistory] = useState<StoredHistory | null>(null)
  const [range, setRange] = useState<HistoryRange>("24h")
  const [currentStatus, setCurrentStatus] = useState<Status | "checking">("checking")
  const [currentResponseTime, setCurrentResponseTime] = useState(0)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const checkingRef = useRef(false)

  const loadStoredHistory = useCallback(
    async (seedWhenEmpty = true) => {
      if (!serviceSlug) return
      setIsChecking(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/public-services/history?service=${encodeURIComponent(serviceSlug)}&range=${range}`,
          { cache: "no-store" },
        )
        if (!response.ok) throw new Error("Could not load stored history")
        const next = (await response.json()) as StoredHistory

        if (!next.current && seedWhenEmpty) {
          await fetch("/api/public-services/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ service: serviceSlug }),
          })
          return await loadStoredHistory(false)
        }

        setHistory(next)
        setCurrentStatus(next.current?.status ?? "checking")
        setCurrentResponseTime(next.current?.responseTime ?? 0)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load stored history")
      } finally {
        setIsChecking(false)
      }
    },
    [range, serviceSlug],
  )

  const checkAdHocWebsite = useCallback(async () => {
    if (checkingRef.current || !isActive) return
    checkingRef.current = true
    setIsChecking(true)
    setCurrentStatus("checking")
    const startedAt = Date.now()

    try {
      const response = await fetch(`/api/check-status?url=${encodeURIComponent(url)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      })
      const result = (await response.json()) as {
        ok?: boolean
        responseTime?: number
      }
      const status: Status = result.ok ? "up" : "down"
      const responseTime = result.responseTime ?? Date.now() - startedAt
      const now = new Date()

      setCurrentStatus(status)
      setCurrentResponseTime(responseTime)
      setSessionData((previous) =>
        [
          ...previous,
          {
            timestamp: now.toISOString(),
            responseTime: status === "up" ? responseTime : 0,
            status,
            formattedTime: now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
        ].slice(-50),
      )
    } catch {
      const now = new Date()
      setCurrentStatus("down")
      setCurrentResponseTime(Date.now() - startedAt)
      setSessionData((previous) =>
        [
          ...previous,
          {
            timestamp: now.toISOString(),
            responseTime: 0,
            status: "down" as const,
            formattedTime: now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
        ].slice(-50),
      )
    } finally {
      checkingRef.current = false
      setIsChecking(false)
    }
  }, [isActive, url])

  useEffect(() => {
    if (!serviceSlug) return
    void loadStoredHistory()
    const interval = window.setInterval(() => void loadStoredHistory(false), 60_000)
    return () => window.clearInterval(interval)
  }, [loadStoredHistory, serviceSlug])

  useEffect(() => {
    if (serviceSlug) return
    void checkAdHocWebsite()
    const interval = window.setInterval(checkAdHocWebsite, 5_000)
    return () => window.clearInterval(interval)
  }, [checkAdHocWebsite, serviceSlug])

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!serviceSlug) return sessionData
    return (history?.points ?? []).map((point) => ({
      ...point,
      formattedTime: formatPointTime(point.timestamp, range),
    }))
  }, [history?.points, range, serviceSlug, sessionData])

  const sessionUp = sessionData.filter((point) => point.status === "up")
  const averageResponseTime = serviceSlug
    ? (history?.summary.averageResponseMs ?? 0)
    : sessionUp.length > 0
      ? Math.round(sessionUp.reduce((sum, point) => sum + point.responseTime, 0) / sessionUp.length)
      : 0
  const maxResponseTime = serviceSlug
    ? (history?.summary.maxResponseMs ?? 0)
    : sessionUp.length > 0
      ? Math.max(...sessionUp.map((point) => point.responseTime))
      : 0
  const uptime = serviceSlug
    ? (history?.summary.uptime ?? null)
    : sessionData.length > 0
      ? (sessionUp.length / sessionData.length) * 100
      : null

  const availabilitySegments = chartData.slice(-120)

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              {name}
              <span
                className={`h-3 w-3 shrink-0 rounded-full ${
                  currentStatus === "up"
                    ? "bg-[color:var(--status-up)]"
                    : currentStatus === "down"
                      ? "bg-[color:var(--status-down)]"
                      : "bg-muted-foreground"
                }`}
              />
              {isChecking && <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />}
            </CardTitle>
            <p className="text-sm text-muted-foreground break-all">{url}</p>
            {serviceSlug && (
              <p className="mt-1 text-xs text-muted-foreground">
                Stored history · scheduled checks every 5 minutes · retained for 6 months
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (serviceSlug ? void loadStoredHistory(false) : setSessionData([]))}
            disabled={isChecking}
            className="self-start bg-transparent"
          >
            {serviceSlug ? <RefreshCw /> : <RotateCcw />}
            {serviceSlug ? "Refresh" : "Clear"}
          </Button>
        </div>

        {serviceSlug && (
          <div className="flex flex-wrap gap-1 pt-2" aria-label="History range">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  range === option.value
                    ? "border-[color:var(--brand-500)] bg-[color:var(--brand-50)] text-[color:var(--brand-700)]"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Status:</span>
            <Badge
              variant={currentStatus === "down" ? "destructive" : "outline"}
              className={
                currentStatus === "up"
                  ? "border-[color:var(--status-up)]/30 bg-[color:var(--status-up)]/10 text-[color:var(--status-up)]"
                  : ""
              }
            >
              {currentStatus === "up" ? "Operational" : currentStatus === "down" ? "Down" : "Awaiting check"}
            </Badge>
          </div>
          <Stat label="Current" value={currentResponseTime ? `${currentResponseTime}ms` : "—"} />
          <Stat label="Avg" value={averageResponseTime ? `${averageResponseTime}ms` : "—"} />
          <Stat label="Max" value={maxResponseTime ? `${maxResponseTime}ms` : "—"} />
          <Stat label="Uptime" value={formatUptime(uptime)} status={uptime} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {serviceSlug && availabilitySegments.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Availability history</span>
              <span>Older → Newer</span>
            </div>
            <div className="flex h-4 items-center gap-px" aria-label="Up and down history">
              {availabilitySegments.map((point) => (
                <span
                  key={point.timestamp}
                  className={`h-full min-w-px flex-1 rounded-[1px] ${
                    point.status === "down"
                      ? "bg-[color:var(--status-down)]"
                      : "bg-[color:var(--status-up)]"
                  }`}
                  title={`${new Date(point.timestamp).toLocaleString()}: ${formatUptime(point.uptime ?? null)} up`}
                />
              ))}
            </div>
          </div>
        )}

        <ChartContainer
          config={{
            responseTime: {
              label: "Response Time (ms)",
              color: "hsl(var(--chart-2))",
            },
          }}
          className="h-[300px] w-full"
        >
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 4, bottom: 24 }}>
            <defs>
              <linearGradient id={`response-time-${serviceSlug ?? "session"}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
            <XAxis
              dataKey="formattedTime"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              angle={-35}
              textAnchor="end"
              height={54}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              width={48}
              label={{ value: "Response (ms)", angle: -90, position: "insideLeft" }}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              labelFormatter={(_, payload) => {
                const timestamp = payload?.[0]?.payload?.timestamp
                return timestamp ? new Date(timestamp).toLocaleString() : ""
              }}
              formatter={(value, _name, item) => {
                const responseTime = typeof value === "number" ? value : Number(value)
                return [
                  `${responseTime}ms${item.payload?.uptime !== undefined ? ` · ${formatUptime(item.payload.uptime)} up` : ""}`,
                  "Response time",
                ]
              }}
            />
            <Area
              type="monotone"
              dataKey="responseTime"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              fill={`url(#response-time-${serviceSlug ?? "session"})`}
              dot={(props: { cx?: number; cy?: number; payload?: ChartPoint; index?: number }) => {
                const { cx, cy, payload, index } = props
                if (cx === undefined || cy === undefined || !payload) {
                  return <circle key={`empty-${index}`} r={0} />
                }
                const color =
                  payload.status === "up"
                    ? "hsl(var(--chart-1))"
                    : "hsl(var(--chart-3))"
                return <circle key={payload.timestamp} cx={cx} cy={cy} r={2} fill={color} stroke={color} />
              }}
              connectNulls={false}
            />
          </AreaChart>
        </ChartContainer>

        {chartData.length === 0 && !isChecking && (
          <div className="-mt-[190px] mb-[150px] text-center text-sm text-muted-foreground">
            No stored checks yet. The first scheduled check will appear here shortly.
          </div>
        )}

        {serviceSlug && history && history.incidents.length > 0 && (
          <div className="rounded-lg border border-border">
            <div className="border-b border-border px-3 py-2 text-sm font-semibold">
              Outage history
            </div>
            <ul className="divide-y divide-border">
              {history.incidents.slice(0, 5).map((incident) => (
                <li
                  key={incident.id}
                  className="flex flex-col gap-1 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[color:var(--status-down)]" />
                    Started {new Date(incident.startedAt).toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">
                    {incident.resolvedAt ? "Resolved" : "Ongoing"} · {formatIncidentDuration(incident.startedAt, incident.resolvedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {serviceSlug && history && (
          <div className="flex flex-col gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {history.summary.checks.toLocaleString()} checks · {history.summary.incidents} outage{history.summary.incidents === 1 ? "" : "s"} in this period
            </span>
            <span>
              {history.current
                ? `Last checked ${new Date(history.current.checkedAt).toLocaleString()}`
                : "Waiting for first scheduled check"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({
  label,
  value,
  status,
}: {
  label: string
  value: string
  status?: number | null
}) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span
        className={`font-medium ${
          status === undefined || status === null
            ? ""
            : status >= 99
              ? "text-[color:var(--status-up)]"
              : status >= 95
                ? "text-[color:var(--status-degraded)]"
                : "text-[color:var(--status-down)]"
        }`}
      >
        {value}
      </span>
    </div>
  )
}
