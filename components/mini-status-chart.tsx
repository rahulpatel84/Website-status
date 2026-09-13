"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { XAxis, YAxis, ResponsiveContainer, Area, AreaChart, Tooltip } from "recharts"

interface MiniStatusChartProps {
  companySlug: string
  name: string
}

interface ChartDataPoint {
  time: string
  reports: number
  formattedTime: string
}

export function MiniStatusChart({ companySlug, name }: MiniStatusChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([])
  const [totalReports, setTotalReports] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const fetchIncidentData = async () => {
    try {
      const response = await fetch(`/api/outage-stats?company=${companySlug}&hours=1`, {
        cache: "no-store",
      })
      
      if (!response.ok) {
        console.error("Failed to fetch incident data")
        return
      }

      const data = await response.json()
      const reports = data.reports || []
      
      setTotalReports(data.total_reports || 0)

      // Process reports into 10-minute intervals for the last hour
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      
      // Create 10-minute intervals
      const intervals: Map<string, number> = new Map()
      
      // Initialize all 10-minute slots in the last hour
      for (let i = 0; i < 6; i++) {
        const slotTime = new Date(oneHourAgo.getTime() + i * 10 * 60 * 1000)
        const timeKey = slotTime.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
        intervals.set(timeKey, 0)
      }

      // Count reports in each interval
      reports.forEach((report: any) => {
        const reportDate = new Date(report.created_at + "Z") // Parse as UTC
        const localReportDate = new Date(reportDate.toLocaleString()) // Convert to local
        
        // Round down to nearest 10-minute interval
        const minutes = localReportDate.getMinutes()
        const roundedMinutes = Math.floor(minutes / 10) * 10
        localReportDate.setMinutes(roundedMinutes, 0, 0)
        
        const timeKey = localReportDate.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
        
        intervals.set(timeKey, (intervals.get(timeKey) || 0) + 1)
      })

      // Convert to chart data
      const chartData: ChartDataPoint[] = Array.from(intervals.entries())
        .map(([time, count]) => ({
          time,
          reports: count,
          formattedTime: time,
        }))
        .sort((a, b) => a.time.localeCompare(b.time))

      setData(chartData)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching incident data:", error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIncidentData()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchIncidentData, 30000)
    
    // Listen for new reports
    const handleNewReport = () => {
      fetchIncidentData()
    }
    window.addEventListener("outageReported", handleNewReport)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener("outageReported", handleNewReport)
    }
  }, [companySlug])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge
          variant={totalReports === 0 ? "default" : "destructive"}
          className={totalReports === 0 ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
        >
          {totalReports === 0 ? "No Issues" : `${totalReports} ${totalReports === 1 ? "Report" : "Reports"}`}
        </Badge>
        <span className="text-xs text-muted-foreground">Last 1 hour</span>
      </div>

      <div className="w-full h-32">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Loading...</div>
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id={`gradient-${companySlug}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 10 }} 
                interval="preserveStartEnd"
                tickFormatter={(value) => value}
              />
              <YAxis 
                tick={{ fontSize: 10 }} 
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ fontSize: "12px" }}
                labelFormatter={(label) => `Time: ${label}`}
                formatter={(value: number) => [`${value} ${value === 1 ? "report" : "reports"}`, "Incidents"]}
              />
              <Area
                type="monotone"
                dataKey="reports"
                stroke="#F97316"
                strokeWidth={2}
                fill={`url(#gradient-${companySlug})`}
                dot={(props) => {
                  const { cx, cy, payload } = props
                  if (!payload || payload.reports === 0) return null
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="#F97316"
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  )
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No data</div>
        )}
      </div>
    </div>
  )
}

