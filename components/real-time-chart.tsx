"use client"

import { useState, useEffect, useRef } from "react"
import { XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"

interface RealTimeDataPoint {
  timestamp: string
  responseTime: number
  status: "up" | "down"
  formattedTime: string
}

interface RealTimeChartProps {
  url: string
  name: string
  isActive: boolean
  onToggle: () => void
}

export function RealTimeChart({ url, name, isActive, onToggle }: RealTimeChartProps) {
  const [data, setData] = useState<RealTimeDataPoint[]>([])
  const [currentStatus, setCurrentStatus] = useState<"up" | "down" | "checking">("checking")
  const [currentResponseTime, setCurrentResponseTime] = useState<number>(0)
  const [isChecking, setIsChecking] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const maxDataPoints = 50 // Keep last 50 data points for smooth scrolling

  // Calculate stats
  const avgResponseTime =
    data.length > 0
      ? Math.round(
          data.filter((d) => d.status === "up").reduce((sum, d) => sum + d.responseTime, 0) /
            data.filter((d) => d.status === "up").length,
        ) || 0
      : 0

  const maxResponseTime =
    data.length > 0 ? Math.max(...data.filter((d) => d.status === "up").map((d) => d.responseTime)) : 0

  const uptime = data.length > 0 ? Math.round((data.filter((d) => d.status === "up").length / data.length) * 100) : 100

  const checkWebsite = async () => {
    if (isChecking) return

    setIsChecking(true)
    setCurrentStatus("checking")
    const startTime = Date.now()

    try {
      const proxyUrl = `/api/check-status?url=${encodeURIComponent(url)}`
      const response = await fetch(proxyUrl, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime
      const status = response.ok ? "up" : "down"

      setCurrentStatus(status)
      setCurrentResponseTime(responseTime)

      const now = new Date()
      const newDataPoint: RealTimeDataPoint = {
        timestamp: now.toISOString(),
        responseTime: status === "up" ? responseTime : 0,
        status,
        formattedTime: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      }

      setData((prevData) => {
        const newData = [...prevData, newDataPoint]
        // Keep only the last maxDataPoints for performance
        return newData.slice(-maxDataPoints)
      })
    } catch (error) {
      const endTime = Date.now()
      const responseTime = endTime - startTime

      setCurrentStatus("down")
      setCurrentResponseTime(responseTime)

      const now = new Date()
      const newDataPoint: RealTimeDataPoint = {
        timestamp: now.toISOString(),
        responseTime: 0,
        status: "down",
        formattedTime: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      }

      setData((prevData) => {
        const newData = [...prevData, newDataPoint]
        return newData.slice(-maxDataPoints)
      })
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    // Initial check
    checkWebsite()

    // Set up 5-second interval
    intervalRef.current = setInterval(() => {
      checkWebsite()
    }, 5000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [url]) // Removed isActive dependency

  const clearData = () => {
    setData([])
  }

  const getStatusColor = (status: "up" | "down" | "checking") => {
    switch (status) {
      case "up":
        return "hsl(var(--chart-1))"
      case "down":
        return "hsl(var(--chart-3))"
      case "checking":
        return "hsl(var(--muted-foreground))"
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {name}
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getStatusColor(currentStatus) }} />
              {isChecking && <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{url}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={clearData} className="flex items-center gap-1 bg-transparent">
              <RotateCcw className="w-3 h-3" />
              Clear
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Status:</span>
            <Badge
              variant={currentStatus === "up" ? "default" : currentStatus === "down" ? "destructive" : "secondary"}
              className={currentStatus === "up" ? "bg-chart-1/10 text-chart-1 border-chart-1/20" : ""}
            >
              {currentStatus === "up" ? "Operational" : currentStatus === "down" ? "Down" : "Checking"}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Current: </span>
            <span className="font-medium">{currentResponseTime}ms</span>
          </div>
          <div>
            <span className="text-muted-foreground">Avg: </span>
            <span className="font-medium">{avgResponseTime}ms</span>
          </div>
          <div>
            <span className="text-muted-foreground">Max: </span>
            <span className="font-medium">{maxResponseTime}ms</span>
          </div>
          <div>
            <span className="text-muted-foreground">Uptime: </span>
            <span
              className={`font-medium ${uptime >= 99 ? "text-chart-1" : uptime >= 95 ? "text-chart-4" : "text-chart-3"}`}
            >
              {uptime}%
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ChartContainer
          config={{
            responseTime: {
              label: "Response Time (ms)",
              color: "hsl(var(--chart-2))",
            },
          }}
          className="h-[300px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="responseTimeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis
                dataKey="formattedTime"
                className="text-xs"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
                minTickGap={5}
              />
              <YAxis
                className="text-xs"
                tick={{ fontSize: 10 }}
                label={{ value: "Response Time (ms)", angle: -90, position: "insideLeft" }}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                labelFormatter={(value) => `Time: ${value}`}
                formatter={(value: number, name: string) => [value > 0 ? `${value}ms` : "Down", "Response Time"]}
              />
              <Area
                type="monotone"
                dataKey="responseTime"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                fill="url(#responseTimeGradient)"
                dot={(props) => {
                  const { cx, cy, payload } = props
                  if (!payload) return null
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={2}
                      fill={payload.status === "up" ? "hsl(var(--chart-1))" : "hsl(var(--chart-3))"}
                      stroke={payload.status === "up" ? "hsl(var(--chart-1))" : "hsl(var(--chart-3))"}
                      strokeWidth={1}
                    />
                  )
                }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        {data.length === 0 && (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">Waiting for data...</div>
        )}
      </CardContent>
    </Card>
  )
}
