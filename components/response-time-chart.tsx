"use client"

import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface ResponseTimeData {
  timestamp: string
  responseTime: number
  status: "up" | "down"
}

interface ResponseTimeChartProps {
  data: ResponseTimeData[]
  title: string
  url?: string
}

export function ResponseTimeChart({ data, title, url }: ResponseTimeChartProps) {
  // Generate sample data if no data provided (for demonstration)
  const chartData = data.length > 0 ? data : generateSampleData()

  const averageResponseTime =
    chartData.length > 0
      ? Math.round(chartData.reduce((sum, item) => sum + item.responseTime, 0) / chartData.length)
      : 0

  const maxResponseTime = chartData.length > 0 ? Math.max(...chartData.map((item) => item.responseTime)) : 0

  const uptime =
    chartData.length > 0
      ? Math.round((chartData.filter((item) => item.status === "up").length / chartData.length) * 100)
      : 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {url && <p className="text-sm text-muted-foreground">{url}</p>}
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Avg Response: </span>
            <span className="font-medium">{averageResponseTime}ms</span>
          </div>
          <div>
            <span className="text-muted-foreground">Max Response: </span>
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
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                className="text-xs"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                }}
              />
              <YAxis
                className="text-xs"
                tick={{ fontSize: 12 }}
                label={{ value: "Response Time (ms)", angle: -90, position: "insideLeft" }}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                labelFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleString()
                }}
                formatter={(value: number, name: string) => [`${value}ms`, "Response Time"]}
              />
              <Line
                type="monotone"
                dataKey="responseTime"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill={payload.status === "up" ? "hsl(var(--chart-1))" : "hsl(var(--chart-3))"}
                      stroke={payload.status === "up" ? "hsl(var(--chart-1))" : "hsl(var(--chart-3))"}
                      strokeWidth={2}
                    />
                  )
                }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// Generate sample data for demonstration
function generateSampleData(): ResponseTimeData[] {
  const data: ResponseTimeData[] = []
  const now = new Date()

  for (let i = 23; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000) // Every hour for 24 hours
    const baseResponseTime = 150 + Math.random() * 100 // Base response time between 150-250ms
    const isDown = Math.random() < 0.05 // 5% chance of being down

    data.push({
      timestamp: timestamp.toISOString(),
      responseTime: isDown ? 0 : Math.round(baseResponseTime + (Math.random() - 0.5) * 50),
      status: isDown ? "down" : "up",
    })
  }

  return data
}
