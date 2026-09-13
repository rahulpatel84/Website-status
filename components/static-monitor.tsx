"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, ExternalLink, Activity } from "lucide-react"
import { RealTimeChart } from "./real-time-chart"
import websitesData from "@/data/websites.json"
import Link from "next/link"

interface Website {
  id: string
  name: string
  url: string
  category: string
  description?: string
  founded?: string
  headquarters?: string
}

export function StaticMonitor({ filterIds }: { filterIds?: Set<string> }) {
  const [websites] = useState<Website[]>(websitesData.websites)
  const [activeMonitors] = useState<Set<string>>(new Set(websitesData.websites.map((w) => w.id)))
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null)

  const visible = filterIds ? websites.filter((w) => filterIds.has(w.id)) : websites

  const groupedWebsites = visible.reduce(
    (acc, website) => {
      if (!acc[website.category]) {
        acc[website.category] = []
      }
      acc[website.category].push(website)
      return acc
    },
    {} as Record<string, Website[]>,
  )

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sites</p>
                <p className="text-2xl font-bold">{websites.length}</p>
              </div>
              <ExternalLink className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Monitors</p>
                <p className="text-2xl font-bold text-chart-1">{activeMonitors.size}</p>
              </div>
              <Activity className="w-8 h-8 text-chart-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Update Interval</p>
                <p className="text-2xl font-bold">5s</p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Real-Time Website Monitoring</h2>
          <p className="text-sm text-muted-foreground">All sites are automatically monitored every 5 seconds</p>
        </div>
      </div>

      {/* Real-time Chart for Selected Website */}
      {selectedWebsite && (
        <RealTimeChart
          url={selectedWebsite.url}
          name={selectedWebsite.name}
          serviceSlug={selectedWebsite.id}
          isActive={true}
          onToggle={() => {}}
        />
      )}

      {/* Website Selection Grid */}
      {Object.entries(groupedWebsites).map(([category, categoryWebsites]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryWebsites.map((website) => (
                <div key={website.id} className="space-y-2">
                  <Link href={`/${website.id}-website-monitor`}>
                    <div
                      className={`p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${
                        selectedWebsite?.id === website.id ? "bg-muted border-chart-2" : ""
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Website info section */}
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0 bg-chart-1 animate-pulse shadow-sm" />
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium truncate">{website.name}</h3>
                            <p className="text-sm text-muted-foreground truncate">{website.url}</p>
                          </div>
                        </div>

                        {/* Status section */}
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="default" className="flex-shrink-0 bg-chart-1 text-white">
                            Auto-Monitoring
                          </Badge>
                          <span className="text-xs text-muted-foreground">Click to view details</span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex justify-center">
                    <button
                      onClick={() => setSelectedWebsite(selectedWebsite?.id === website.id ? null : website)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {selectedWebsite?.id === website.id ? "Hide Chart" : "Quick View Chart"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
