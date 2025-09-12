"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Globe, Users, AlertCircle } from "lucide-react"

interface LocationData {
  city: string
  state: string
  country: string
  latitude: number
  longitude: number
  report_count: number
  issue_type: string
  latest_report: string
}

interface RegionStats {
  country: string
  state: string
  total_reports: number
  cities_affected: number
}

interface OutageHeatMapProps {
  companySlug: string
  companyName: string
}

export function OutageHeatMap({ companySlug, companyName }: OutageHeatMapProps) {
  const [locationData, setLocationData] = useState<LocationData[]>([])
  const [regionStats, setRegionStats] = useState<RegionStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLocationData = async () => {
      try {
        const response = await fetch(`/api/outage-locations?company=${companySlug}&hours=24`)
        if (response.ok) {
          const data = await response.json()
          setLocationData(data.locations || [])
          setRegionStats(data.stats || [])
        }
      } catch (error) {
        console.error("Failed to fetch location data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLocationData()

    // Refresh every 5 minutes
    const interval = setInterval(fetchLocationData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [companySlug])

  const getIntensityColor = (count: number, maxCount: number) => {
    if (maxCount === 0) return "bg-gray-100"
    const intensity = count / maxCount
    if (intensity > 0.8) return "bg-red-600"
    if (intensity > 0.6) return "bg-red-500"
    if (intensity > 0.4) return "bg-red-400"
    if (intensity > 0.2) return "bg-red-300"
    if (intensity > 0) return "bg-red-200"
    return "bg-gray-100"
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-US", {
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
            <MapPin className="w-5 h-5 text-blue-500" />
            Outage Heat Map - Geographic Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground">Loading location data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxReports = Math.max(...locationData.map((l) => l.report_count), 1)
  const totalLocations = locationData.length
  const totalCountries = new Set(locationData.map((l) => l.country)).size

  return (
    <div className="space-y-4">
      {/* Geographic Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Affected Locations</p>
                <p className="text-2xl font-bold">{totalLocations}</p>
              </div>
              <MapPin className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Countries</p>
                <p className="text-2xl font-bold">{totalCountries}</p>
              </div>
              <Globe className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hotspot</p>
                <p className="text-lg font-bold">
                  {locationData.length > 0
                    ? `${locationData[0].city}, ${locationData[0].state || locationData[0].country}`
                    : "None"}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Peak Reports</p>
                <p className="text-2xl font-bold text-red-600">{maxReports}</p>
              </div>
              <Users className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heat Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            Outage Heat Map - Geographic Distribution
          </CardTitle>
          <p className="text-sm text-muted-foreground">Showing outage reports by location in the last 24 hours</p>
        </CardHeader>
        <CardContent>
          {locationData.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No location data available</p>
              <p className="text-sm text-muted-foreground">
                Outage reports will appear here once users start reporting issues
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Legend */}
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">Intensity:</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-200 rounded"></div>
                  <span>Low</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-400 rounded"></div>
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-600 rounded"></div>
                  <span>High</span>
                </div>
              </div>

              {/* Location Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {locationData.slice(0, 12).map((location, index) => (
                  <div
                    key={`${location.city}-${location.state}-${index}`}
                    className={`p-3 rounded-lg border ${getIntensityColor(location.report_count, maxReports)} ${
                      location.report_count > maxReports * 0.4 ? "text-white" : "text-gray-900"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span className="font-medium text-sm">
                          {location.city}
                          {location.state && `, ${location.state}`}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={location.report_count > maxReports * 0.4 ? "bg-white/20 text-white" : ""}
                      >
                        {location.report_count}
                      </Badge>
                    </div>
                    <div className="text-xs opacity-90">
                      <p>{location.country}</p>
                      <p>Latest: {formatTime(location.latest_report)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {locationData.length > 12 && (
                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing top 12 locations. {locationData.length - 12} more locations affected.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regional Breakdown */}
      {regionStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-green-500" />
              Regional Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {regionStats.slice(0, 8).map((region, index) => (
                <div
                  key={`${region.country}-${region.state}-${index}`}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                      <Globe className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {region.state ? `${region.state}, ${region.country}` : region.country}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {region.cities_affected} {region.cities_affected === 1 ? "city" : "cities"} affected
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {region.total_reports} reports
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
