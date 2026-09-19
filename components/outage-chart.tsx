"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Area, AreaChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { AlertTriangle, Users, MapPin, TrendingUp } from "lucide-react"

interface OutageData {
  created_at: string
  total_reports: number
  formattedTime: string
  fullTime?: string
  trend?: number
  baseline?: number
  timestampMs: number
}

interface ReportData {
  created_at: string
  issue_type: string
  report_count: number
}

interface SummaryData {
  total_reports: number
  website_reports: number
  services_reports: number
  api_reports: number
  mobile_app_reports: number
  payment_system_reports: number
  login_reports: number
  other_reports: number
}

interface OutageChartProps {
  companySlug: string
  companyName: string
}

export function OutageChart({ companySlug, companyName }: OutageChartProps) {
  const [outageData, setOutageData] = useState<OutageData[]>([])
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [totalReports, setTotalReports] = useState(0)

  useEffect(() => {
    const fetchOutageData = async () => {
      try {
        const response = await fetch(`/api/outage-stats?company=${companySlug}&hours=24`)
        if (response.ok) {
          const data = await response.json()
          console.log('Fetched outage data:', data) // Debug log

          // Process individual reports with exact timestamps
          const processedData = processReportsData(data.reports || [])
          console.log('Raw reports:', data.reports) // Debug log
          console.log('Processed data:', processedData) // Debug log
          console.log('Processed data length:', processedData.length) // Debug log
          setOutageData(processedData)

          // Set summary data
          setSummaryData(data.summary)
          setTotalReports(data.total_reports || 0)
          console.log('Total reports:', data.total_reports) // Debug log
        }
      } catch (error) {
        console.error("Failed to fetch outage data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchOutageData()

    // Refresh every 10 seconds for testing (was 5 minutes)
    const interval = setInterval(fetchOutageData, 10 * 1000)
    
    // Listen for outage reports to refresh immediately
    const handleOutageReported = () => {
      console.log('Outage reported, refreshing chart...')
      fetchOutageData()
    }
    
    window.addEventListener('outageReported', handleOutageReported)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('outageReported', handleOutageReported)
    }
  }, [companySlug])

  const processReportsData = (reports: ReportData[]): OutageData[] => {
    console.log('Processing reports for 24-hour spike chart:', reports)
    
    // Get current time in local timezone
    const now = new Date()
    
    // Create data points for each individual report (spikes at exact times)
    const chartData: OutageData[] = []
    const reportTimes = new Map<string, number>()
    
    // Process each report individually for exact timing
    if (reports && reports.length > 0) {
      reports.forEach(report => {
        // Parse the UTC timestamp from database
        const reportDateUTC = new Date(report.created_at + 'Z')
        
        // The browser automatically converts UTC to local time when displaying
        // So we can use the UTC date directly for grouping
        const timeKey = reportDateUTC.toISOString()
        reportTimes.set(timeKey, (reportTimes.get(timeKey) || 0) + 1)
        
        console.log(`📊 PROCESSING REPORT: ${report.created_at} UTC -> ${reportDateUTC.toLocaleString()} local`)
        console.log(`📊 Time Key: ${timeKey}`)
      })
    }
    
    console.log('Report spikes map:', Array.from(reportTimes.entries()))
    
    // Generate 24-hour timeline starting from 12:00 AM today (local time)
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0) // Start at 12:00 AM local time
    
    // Generate 24 hours of data with 10-minute intervals for precise spikes  
    const intervals = 24 * 6 // 24 hours * 6 (10-minute intervals) = 144 points
    
    for (let i = 0; i < intervals; i++) {
      const currentTime = new Date(startOfDay.getTime() + i * 10 * 60 * 1000) // 10-minute intervals
      
      // Count all reports that fall within this 10-minute window
      let reportCount = 0
      let actualReportTime = currentTime.toISOString() // Default to window time
      reportTimes.forEach((count, timeKey) => {
        const reportTime = new Date(timeKey)
        const windowStart = currentTime
        const windowEnd = new Date(currentTime.getTime() + 10 * 60 * 1000)
        
        // Check if the report falls in this window
        if (reportTime >= windowStart && reportTime < windowEnd) {
          reportCount += count
          actualReportTime = timeKey // Use actual report time for tooltip
          console.log(`✅ MATCH: Report at ${reportTime.toLocaleString()} matches window ${windowStart.toLocaleString()}`)
        }
      })
      
      // Format time for display - show labels every 24 points (4 hours: 12am, 4am, 8am, 12pm, 4pm, 8pm)
      const shouldShowLabel = i % 24 === 0 // Every 24th point (4 hours)
      const timeLabel = currentTime.toLocaleTimeString("en-GB", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
      const displayLabel = shouldShowLabel ? currentTime.toLocaleTimeString("en-GB", {
        hour: "numeric",
        hour12: true
      }) : ""
      
      if (reportCount > 0) {
        console.log(`⚡ SPIKE: ${timeLabel} has ${reportCount} reports`)
      }
      
      chartData.push({
        created_at: actualReportTime, // Use actual report time for tooltip
        total_reports: reportCount,
        formattedTime: displayLabel, // Not used by axis anymore, kept for debugging
        fullTime: timeLabel, // Keep full time for tooltip (exact 10-min precision)
        trend: 0, // No baseline needed for spike chart
        baseline: 0,
        timestampMs: currentTime.getTime(),
      })
    }

    console.log('24-hour spike chart data created:', chartData)
    console.log('Data points with spikes:', chartData.filter(d => d.total_reports > 0))
    return chartData
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }


  const formatTooltipTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[color:var(--brand-500)]" />
            {companyName} outages reported in the last 24 hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground">Loading outage data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reports</p>
                <p className="text-2xl font-bold text-[color:var(--brand-600)]">{totalReports}</p>
              </div>
              <Users className="w-8 h-8 text-[color:var(--brand-500)]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Peak Hour</p>
                <p className="text-lg font-bold">
                  {outageData.length > 0
                    ? formatTime(
                        outageData.reduce((max, item) => (item.total_reports > max.total_reports ? item : max))
                          .created_at,
                      )
                    : "N/A"}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Most Affected</p>
                <p className="text-lg font-bold">
                  {(() => {
                    if (!summaryData) return "None"
                    
                    const totals = {
                      website: summaryData.website_reports,
                      services: summaryData.services_reports,
                      api: summaryData.api_reports,
                      mobile: summaryData.mobile_app_reports,
                      payment: summaryData.payment_system_reports,
                      login: summaryData.login_reports,
                    }

                    const max = Object.entries(totals).reduce((a, b) => (totals[a[0] as keyof typeof totals] > totals[b[0] as keyof typeof totals] ? a : b))
                    return max[1] > 0 ? max[0].charAt(0).toUpperCase() + max[0].slice(1) : "None"
                  })()}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-[color:var(--brand-500)]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={totalReports > 10 ? "destructive" : totalReports > 0 ? "secondary" : "default"}>
                  {totalReports > 10 ? "High Activity" : totalReports > 0 ? "Some Issues" : "Stable"}
                </Badge>
              </div>
              <MapPin className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[color:var(--brand-500)]" />
{companyName} incident reports - 24 hours (4-hour intervals)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading outage data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={outageData} margin={{ top: 10, right: 30, left: 20, bottom: 80 }}>
                <defs>
                  <linearGradient id="spikeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="timestampMs"
                  type="number"
                  domain={[new Date(new Date().setHours(0,0,0,0)).getTime(), new Date(new Date().setHours(24,0,0,0)).getTime()]}
                  tickFormatter={(ts) => {
                    const d = new Date(ts)
                    return d.toLocaleTimeString('en-GB', { hour: 'numeric', hour12: true })
                  }}
                  ticks={Array.from({ length: 13 }, (_, i) => new Date(new Date().setHours(i * 2, 0, 0, 0)).getTime())}
                  allowDuplicatedCategory={false}
                  height={50}
                  fontSize={11}
                  tick={{ fill: '#666', fontSize: 11 }}
                />
                <YAxis 
                  fontSize={11}
                  domain={[0, 'dataMax + 2']}
                  allowDecimals={false}
                  tick={{ fill: '#666', fontSize: 11 }}
                  tickCount={6}
                  label={{ value: 'Incident Reports', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                />
                <Tooltip
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0 && payload[0].payload) {
                      const utcTime = payload[0].payload.created_at
                      const local = new Date(utcTime)
                      const dateStr = local.toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' })
                      const timeStr = local.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
                      return `${dateStr} at ${timeStr}`
                    }
                    return ''
                  }}
                  formatter={(value: any, name: string, props: any) => {
                    console.log('🔍 Tooltip formatter - Value:', value, 'Name:', name, 'Props:', props) // Debug log
                    const numValue = Number(value)
                    if (name === "incident_reports") {
                      return [`${numValue}`, numValue === 1 ? "Report" : "Reports"]
                    }
                    return [value, name]
                  }}
                  contentStyle={{
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    border: "none",
                    borderRadius: "6px",
                    color: "white",
                    fontSize: "12px"
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total_reports"
                  stroke="#F97316"
                  strokeWidth={3}
                  fill="url(#spikeGradient)"
                  name="incident_reports"
                  dot={false}
                  activeDot={{ r: 6, stroke: '#F97316', strokeWidth: 2, fill: '#ffffff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
