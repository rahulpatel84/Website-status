"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { AlertTriangle, Users, MapPin, TrendingUp } from "lucide-react"

interface OutageData {
  hour_timestamp: string
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
  const [loading, setLoading] = useState(true)
  const [totalReports, setTotalReports] = useState(0)

  useEffect(() => {
    const fetchOutageData = async () => {
      try {
        const response = await fetch(`/api/outage-stats?company=${companySlug}&hours=24`)
        if (response.ok) {
          const data = await response.json()

          // Fill in missing hours with zero data
          const filledData = fillMissingHours(data.stats || [])
          setOutageData(filledData)

          // Calculate total reports
          const total = filledData.reduce((sum, item) => sum + item.total_reports, 0)
          setTotalReports(total)
        }
      } catch (error) {
        console.error("Failed to fetch outage data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchOutageData()

    // Refresh every 5 minutes
    const interval = setInterval(fetchOutageData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [companySlug])

  const fillMissingHours = (data: OutageData[]): OutageData[] => {
    const now = new Date()
    const hours: OutageData[] = []

    // Generate last 24 hours
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
      hour.setMinutes(0, 0, 0)

      const existingData = data.find((d) => new Date(d.hour_timestamp).getTime() === hour.getTime())

      hours.push(
        existingData || {
          hour_timestamp: hour.toISOString(),
          total_reports: 0,
          website_reports: 0,
          services_reports: 0,
          api_reports: 0,
          mobile_app_reports: 0,
          payment_system_reports: 0,
          login_reports: 0,
          other_reports: 0,
        },
      )
    }

    return hours
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
            <AlertTriangle className="w-5 h-5 text-red-500" />
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
                <p className="text-2xl font-bold text-red-600">{totalReports}</p>
              </div>
              <Users className="w-8 h-8 text-red-500" />
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
                          .hour_timestamp,
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
                    const totals = outageData.reduce(
                      (acc, item) => ({
                        website: acc.website + item.website_reports,
                        services: acc.services + item.services_reports,
                        api: acc.api + item.api_reports,
                        mobile: acc.mobile + item.mobile_app_reports,
                        payment: acc.payment + item.payment_system_reports,
                        login: acc.login + item.login_reports,
                      }),
                      { website: 0, services: 0, api: 0, mobile: 0, payment: 0, login: 0 },
                    )

                    const max = Object.entries(totals).reduce((a, b) => (totals[a[0]] > totals[b[0]] ? a : b))
                    return max[1] > 0 ? max[0].charAt(0).toUpperCase() + max[0].slice(1) : "None"
                  })()}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
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
              <MapPin className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            {companyName} outages reported in the last 24 hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={outageData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="hour_timestamp"
                  tickFormatter={formatTime}
                  interval={2}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  labelFormatter={(value) => formatTooltipTime(value as string)}
                  formatter={(value: number, name: string) => [
                    value,
                    name
                      .replace("_reports", "")
                      .replace("_", " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase()),
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value
                      .replace("_reports", "")
                      .replace("_", " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())
                  }
                />
                <Area
                  type="monotone"
                  dataKey="total_reports"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#totalGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
