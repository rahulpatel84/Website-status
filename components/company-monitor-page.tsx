"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, Globe, Clock, Activity, Building, Calendar } from "lucide-react"
import { RealTimeChart } from "./real-time-chart"
import Link from "next/link"
import { OutageReporting } from "./outage-reporting"
import { OutageChart } from "./outage-chart"
import { OutageHeatMap } from "./outage-heat-map"

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
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
            <Globe className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-balance">{website.name} Website Monitor</h1>
            <p className="text-muted-foreground">Real-time monitoring and performance tracking</p>
          </div>
        </div>
      </div>

      {/* Company Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl">{website.name}</CardTitle>
              <Badge variant="secondary">{website.category}</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(website.url, "_blank")}
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Visit Site
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">About {website.name}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {website.description ||
                  `${website.name} is a popular online service providing various digital solutions and services to users worldwide.`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">URL:</span>
                <code className="bg-muted px-2 py-1 rounded text-xs">{website.url}</code>
              </div>

              {website.founded && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Founded:</span>
                  <span>{website.founded}</span>
                </div>
              )}

              {website.headquarters && (
                <div className="flex items-center gap-2 text-sm">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Headquarters:</span>
                  <span>{website.headquarters}</span>
                </div>
              )}
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
  )
}
