"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Globe, Users, AlertCircle } from "lucide-react"
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from "react-simple-maps"

interface LocationData {
  city: string
  state: string
  country: string
  latitude: number
  longitude: number
  report_count: number
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
  const mapWrapperRef = useRef<HTMLDivElement | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; city: string; count: number } | null>(null)
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [0, 20],
    zoom: 1,
  })
  const [selectedCity, setSelectedCity] = useState<{ city: string; state?: string | null; country?: string | null } | null>(null)
  const [cityReports, setCityReports] = useState<{ issue_type: string; created_at: string }[]>([])
  const [sseConnected, setSseConnected] = useState(false)

  useEffect(() => {
    const fetchLocationData = async () => {
      try {
        const response = await fetch(`/api/outage-locations?company=${companySlug}&hours=24`, { cache: 'no-store' })
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

    // Auto-refresh every 30s and also on outageReported event
    const interval = setInterval(fetchLocationData, 30 * 1000)

    const handleOutageReported = (e: any) => {
      if (!e?.detail?.companySlug || e.detail.companySlug === companySlug) {
        fetchLocationData()
      }
    }
    window.addEventListener('outageReported', handleOutageReported)

    return () => {
      clearInterval(interval)
      window.removeEventListener('outageReported', handleOutageReported)
    }
  }, [companySlug])

  // SSE realtime: update heat map immediately
  useEffect(() => {
    const es = new EventSource('/api/events')
    es.addEventListener('ping', () => setSseConnected(true))
    es.addEventListener('outage-reported', (e: MessageEvent) => {
      const data = JSON.parse(e.data || '{}')
      if (!data?.companySlug || data.companySlug !== companySlug) return
      // Soft refresh
      fetch(`/api/outage-locations?company=${companySlug}&hours=24`, { cache: 'no-store' }).then(async (r) => {
        if (r.ok) {
          const d = await r.json()
          setLocationData(d.locations || [])
          setRegionStats(d.stats || [])
        }
      })
    })
    es.onerror = () => {
      setSseConnected(false)
    }
    return () => es.close()
  }, [companySlug])

  // Keep tooltip count in sync with latest data
  useEffect(() => {
    if (!tooltip) return
    const match = locationData.find(
      (l) => l.city === tooltip.city
    )
    if (match && match.report_count !== tooltip.count) {
      setTooltip({ ...tooltip, count: match.report_count })
    }
  }, [locationData])

  // Load selected city reports
  const loadCityReports = async (city: string, state?: string | null, country?: string | null) => {
    const params = new URLSearchParams({ company: companySlug, city, limit: '10' })
    if (state) params.append('state', state)
    if (country) params.append('country', country)
    const res = await fetch(`/api/outage-city-reports?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setCityReports(data.reports || [])
    }
  }

  const getColor = (count: number, maxCount: number) => {
    if (maxCount === 0) return "rgba(239,68,68,0.15)" // red-500 @ 15%
    const ratio = count / maxCount
    if (ratio > 0.8) return "rgba(239,68,68,0.85)" // red-500
    if (ratio > 0.6) return "rgba(239,68,68,0.65)"
    if (ratio > 0.4) return "rgba(239,68,68,0.45)"
    if (ratio > 0.2) return "rgba(239,68,68,0.30)"
    if (ratio > 0) return "rgba(239,68,68,0.18)"
    return "rgba(239,68,68,0.10)"
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

  // Pre-compute adjusted markers to avoid overlapping points (hook at top-level, before any early returns)
  const adjustedMarkers = useMemo(() => {
    const groups = new Map<string, LocationData[]>()
    locationData.forEach((l) => {
      // Group strictly by city to ensure a single marker per city
      const key = `${(l.city || '').trim().toLowerCase()}|${(l.state || '').trim().toLowerCase()}|${(l.country || '').trim().toLowerCase()}`
      const arr = groups.get(key) || []
      arr.push(l)
      groups.set(key, arr)
    })

    const adjusted: Array<LocationData & { adjLat: number; adjLon: number }> = []
    groups.forEach((arr) => {
      // Merge duplicates of the same city into a single marker with averaged lat/lon and summed counts
      const sum = arr.reduce(
        (acc, cur) => {
          acc.lat += cur.latitude
          acc.lon += cur.longitude
          acc.count += cur.report_count
          return acc
        },
        { lat: 0, lon: 0, count: 0 }
      )
      const avgLat = sum.lat / arr.length
      const avgLon = sum.lon / arr.length
      const merged = { ...arr[0], latitude: avgLat, longitude: avgLon, report_count: sum.count }
      adjusted.push({ ...merged, adjLat: avgLat, adjLon: avgLon })
    })

    return adjusted
  }, [locationData])

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

  // (adjustedMarkers already computed above)

  const getRadius = (count: number) => {
    const base = 2 + Math.log(count + 1)
    const scaled = Math.min(8, Math.max(2, base))
    return scaled
  }

  // Deterministic pastel color per city (subdued; not overly bright)
  const getCityColor = (city: string, alpha = 0.75) => {
    let hash = 0
    for (let i = 0; i < city.length; i++) {
      hash = (hash << 5) - hash + city.charCodeAt(i)
      hash |= 0
    }
    const hue = Math.abs(hash) % 360
    const saturation = 55 // subdued
    const lightness = 62 // pastel
    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`
  }

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

              {/* World Heat Map */}
              <div ref={mapWrapperRef} className="relative w-full h-[480px] rounded-lg border overflow-hidden">
                {/* Zoom controls */}
                <div className="absolute z-10 right-3 top-3 flex gap-2">
                  <button
                    className="px-2 py-1 rounded bg-white/90 border text-sm"
                    onClick={() => setPosition((p) => ({ ...p, zoom: Math.min(p.zoom + 0.5, 6) }))}
                  >
                    +
                  </button>
                  <button
                    className="px-2 py-1 rounded bg-white/90 border text-sm"
                    onClick={() => setPosition((p) => ({ ...p, zoom: Math.max(p.zoom - 0.5, 1) }))}
                  >
                    -
                  </button>
                  <button
                    className="px-2 py-1 rounded bg-white/90 border text-sm"
                    onClick={() => setPosition({ coordinates: [0, 20], zoom: 1 })}
                  >
                    Reset
                  </button>
                      </div>

                <ComposableMap projectionConfig={{ scale: 160 }} style={{ width: "100%", height: "100%" }}>
                  <ZoomableGroup
                    center={position.coordinates}
                    zoom={position.zoom}
                    minZoom={1}
                    maxZoom={6}
                    onMoveEnd={(pos) => setPosition({ coordinates: pos.coordinates as [number, number], zoom: pos.zoom })}
                  >
                    <Geographies geography={"https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"}>
                      {({ geographies }) =>
                        geographies.map((geo) => (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill="#f8fafc"
                            stroke="#e2e8f0"
                            strokeWidth={0.5}
                          />
                        ))
                      }
                    </Geographies>

                    {adjustedMarkers.map((loc, idx) => (
                      <Marker
                        key={`${loc.city}-${loc.state}-${idx}`}
                        coordinates={[loc.adjLon, loc.adjLat]}
                        onMouseEnter={(e) => {
                          const rect = mapWrapperRef.current?.getBoundingClientRect()
                          const x = rect ? e.clientX - rect.left : 0
                          const y = rect ? e.clientY - rect.top : 0
                          setTooltip({ x, y, city: loc.city, count: loc.report_count })
                        }}
                        onMouseMove={(e) => {
                          if (!mapWrapperRef.current) return
                          const rect = mapWrapperRef.current.getBoundingClientRect()
                          setTooltip((t) => (t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top } : t))
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => {
                          setSelectedCity({ city: loc.city, state: loc.state, country: loc.country })
                          loadCityReports(loc.city, loc.state, loc.country)
                        }}
                      >
                        <circle r={getRadius(loc.report_count)} fill={getColor(loc.report_count, maxReports)} stroke={getColor(loc.report_count, maxReports)} strokeWidth={0.6} />
                      </Marker>
                    ))}
                  </ZoomableGroup>
                </ComposableMap>

                {/* Tooltip */}
                {tooltip && (
                  <div
                    className="absolute pointer-events-none bg-black/80 text-white text-xs px-2 py-1 rounded shadow"
                    style={{ left: Math.max(8, tooltip.x + 10), top: Math.max(8, tooltip.y + 10) }}
                  >
                    <div className="font-medium">{tooltip.city}</div>
                    <div className="opacity-80">{tooltip.count} {tooltip.count === 1 ? "report" : "reports"}</div>
                  </div>
                )}
              </div>

              {/* City details side panel */}
              {selectedCity && (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-start-3 lg:row-start-1">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{selectedCity.city}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {cityReports.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No recent reports</div>
                        ) : (
                          <ul className="space-y-2 text-sm">
                            {cityReports.map((r, i) => (
                              <li key={i} className="flex items-center justify-between border-b last:border-b-0 pb-2">
                                <span>Report</span>
                                <span className="text-muted-foreground">
                                  {new Date(r.created_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

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
