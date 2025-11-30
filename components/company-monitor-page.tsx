"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, Globe, Clock, Activity, Building, Calendar, TrendingUp } from "lucide-react"
import { RealTimeChart } from "./real-time-chart"
import Link from "next/link"
import { OutageReporting } from "./outage-reporting"
import { OutageChart } from "./outage-chart"
import { OutageHeatMap } from "./outage-heat-map"
import websitesData from "@/data/websites.json"

interface Website {
  id: string
  name: string
  url: string
  category: string
  description?: string
  founded?: string
  headquarters?: string
}

interface CompanyMonitorPageProps {
  website: Website
}

export function CompanyMonitorPage({ website }: CompanyMonitorPageProps) {
  // Get related websites from the same category
  const relatedWebsites = websitesData.websites
    .filter((w) => w.category === website.category && w.id !== website.id)
    .slice(0, 4)

  // Get other popular websites
  const otherWebsites = websitesData.websites
    .filter((w) => w.id !== website.id)
    .slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <div>
        <Link href="/">
          <Button variant="outline" size="default" className="flex items-center gap-2 hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{website.name} Website Monitor</h1>
        <p className="text-base text-muted-foreground">Real-time monitoring and user-reported incidents</p>
      </div>

      {/* Two Column Layout */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column - Main Content */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Company Info Card with Logo and Details */}
          <Card className="border-2">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Logo Section */}
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg">
                <Globe className="w-12 h-12 md:w-16 md:h-16 text-white" />
              </div>
            </div>

            {/* Brand Info Section */}
            <div className="flex-1 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl md:text-3xl font-bold">{website.name}</h2>
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                      {website.category}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-3xl">
                    {website.description ||
                      `${website.name} is a popular online service providing various digital solutions and services to users worldwide.`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => window.open(website.url, "_blank")}
                  className="flex items-center gap-2 whitespace-nowrap self-start"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit Site
                </Button>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                    <Globe className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Website</p>
                    <code className="text-sm font-medium">{website.url.replace("https://", "")}</code>
                  </div>
                </div>

                {website.founded && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
                      <Calendar className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Founded</p>
                      <p className="text-sm font-medium">{website.founded}</p>
                    </div>
                  </div>
                )}

                {website.headquarters && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
                      <Building className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Headquarters</p>
                      <p className="text-sm font-medium">{website.headquarters}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </CardContent>
          </Card>

          {/* Monitoring Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monitoring Status</p>
                <p className="text-2xl font-bold text-chart-1">Active</p>
              </div>
              <Activity className="w-8 h-8 text-chart-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Check Interval</p>
                <p className="text-2xl font-bold">5s</p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="text-2xl font-bold">{website.category}</p>
              </div>
              <Globe className="w-8 h-8 text-muted-foreground" />
            </div>
            </CardContent>
          </Card>
          </div>

          {/* Real-time Chart */}
          <RealTimeChart url={website.url} name={website.name} isActive={true} onToggle={() => {}} />

          {/* Outage Reporting */}
          <OutageReporting companyName={website.name} companySlug={website.id} />

          <OutageChart companySlug={website.id} companyName={website.name} />

          <OutageHeatMap companySlug={website.id} companyName={website.name} />
        </div>

        {/* Right Sidebar */}
        <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-6">
          {/* Other Related Websites/Apps */}
          {otherWebsites.length > 0 && (
            <Card className="shadow-sm border-2">
              <CardHeader className="pb-4 border-b">
                <CardTitle className="text-base font-bold">Other Related Websites/Apps</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Popular services you might want to monitor</p>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {otherWebsites.map((site) => (
                  <Link key={site.id} href={`/${site.id}-website-monitor`}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white border-2 border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer group">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate group-hover:text-red-600 transition-colors">{site.name}</p>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {site.category}
                        </Badge>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-red-500 flex-shrink-0 transition-colors ml-2" />
                    </div>
                  </Link>
                ))}
                <div className="pt-2">
                  <Link href="/">
                    <Button variant="outline" className="w-full border-2 hover:bg-gray-50 font-medium" size="default">
                      View All Services →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* More in Same Category */}
          {relatedWebsites.length > 0 && (
            <Card className="shadow-sm border-2">
              <CardHeader className="pb-4 border-b">
                <CardTitle className="text-base font-bold">More in {website.category}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Other {website.category.toLowerCase()} services</p>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {relatedWebsites.map((site) => (
                  <Link key={site.id} href={`/${site.id}-website-monitor`}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white border-2 border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer group">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate group-hover:text-red-600 transition-colors">{site.name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{site.url.replace("https://www.", "").replace("https://", "")}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-red-500 flex-shrink-0 transition-colors ml-2" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick Stats Card */}
          <Card className="shadow-sm border-2 bg-gradient-to-br from-gray-50 to-white">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Status</span>
                </div>
                <Badge className="bg-green-600 hover:bg-green-600">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Check Interval</span>
                </div>
                <span className="text-sm font-bold">5s</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium">Category</span>
                </div>
                <Badge variant="secondary">{website.category}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Website Info Card */}
          <Card className="shadow-sm border-2">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold">Website Information</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">URL</p>
                    <code className="text-xs font-medium break-all">{website.url}</code>
                  </div>
                </div>
                {website.founded && (
                  <div className="flex items-start gap-2 pt-2 border-t">
                    <Calendar className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Founded</p>
                      <p className="text-sm font-medium">{website.founded}</p>
                    </div>
                  </div>
                )}
                {website.headquarters && (
                  <div className="flex items-start gap-2 pt-2 border-t">
                    <Building className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Headquarters</p>
                      <p className="text-sm font-medium">{website.headquarters}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
