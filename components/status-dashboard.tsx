"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Globe, Search } from "lucide-react"
import { StaticMonitor } from "./static-monitor"
import { CustomChecker } from "./custom-checker"

export function StatusDashboard() {
  const [overallStatus, setOverallStatus] = useState<"operational" | "degraded" | "down">("operational")

  useEffect(() => {
    // This would typically be calculated based on actual website statuses
    // For now, we'll simulate it
    const interval = setInterval(() => {
      const random = Math.random()
      if (random > 0.95) {
        setOverallStatus("down")
      } else if (random > 0.85) {
        setOverallStatus("degraded")
      } else {
        setOverallStatus("operational")
      }
    }, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [])

  const getStatusBadge = () => {
    switch (overallStatus) {
      case "operational":
        return (
          <Badge variant="secondary" className="px-3 py-1 bg-chart-1 text-white border-chart-1">
            <div className="w-2 h-2 bg-white rounded-full mr-2" />
            All Systems Operational
          </Badge>
        )
      case "degraded":
        return (
          <Badge variant="secondary" className="px-3 py-1 bg-chart-4 text-white border-chart-4">
            <div className="w-2 h-2 bg-white rounded-full mr-2" />
            Degraded Performance
          </Badge>
        )
      case "down":
        return (
          <Badge variant="destructive" className="px-3 py-1">
            <div className="w-2 h-2 bg-white rounded-full mr-2" />
            System Issues Detected
          </Badge>
        )
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
            <Activity className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-balance">Website Status Monitor</h1>
            <p className="text-muted-foreground">Real-time monitoring and performance tracking</p>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      {/* Tabs for different monitoring views */}
      <Tabs defaultValue="monitored" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="monitored" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Monitored Sites
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Custom Check
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitored" className="space-y-4">
          <StaticMonitor />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <CustomChecker />
        </TabsContent>
      </Tabs>
    </div>
  )
}
