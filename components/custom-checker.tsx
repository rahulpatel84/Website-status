"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, Clock, Search, Trash2, ExternalLink, AlertCircle, Activity } from "lucide-react"
import { RealTimeChart } from "./real-time-chart"

interface CheckResult {
  id: string
  url: string
  status: "up" | "down" | "checking"
  responseTime?: number
  statusCode?: number
  statusText?: string
  checkedAt: Date
  error?: string
}

export function CustomChecker() {
  const [url, setUrl] = useState("")
  const [results, setResults] = useState<CheckResult[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [selectedForRealTime, setSelectedForRealTime] = useState<string | null>(null)
  const [activeMonitors, setActiveMonitors] = useState<Set<string>>(new Set())

  const isValidUrl = (urlString: string) => {
    try {
      const url = new URL(urlString)
      return url.protocol === "http:" || url.protocol === "https:"
    } catch {
      return false
    }
  }

  const checkUrl = async () => {
    if (!url.trim()) return

    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = "https://" + normalizedUrl
    }

    if (!isValidUrl(normalizedUrl)) {
      const errorResult: CheckResult = {
        id: Date.now().toString(),
        url: normalizedUrl,
        status: "down",
        checkedAt: new Date(),
        error: "Invalid URL format",
      }
      setResults((prev) => [errorResult, ...prev])
      return
    }

    const resultId = Date.now().toString()
    const checkingResult: CheckResult = {
      id: resultId,
      url: normalizedUrl,
      status: "checking",
      checkedAt: new Date(),
    }

    setResults((prev) => [checkingResult, ...prev])
    setIsChecking(true)

    try {
      const response = await fetch(`/api/check-status?url=${encodeURIComponent(normalizedUrl)}`)
      const data = await response.json()

      const finalResult: CheckResult = {
        id: resultId,
        url: normalizedUrl,
        status: data.ok ? "up" : "down",
        responseTime: data.responseTime,
        statusCode: data.status,
        statusText: data.statusText,
        checkedAt: new Date(),
        error: data.error,
      }

      setResults((prev) => prev.map((result) => (result.id === resultId ? finalResult : result)))

      if (data.ok) {
        setActiveMonitors((prev) => new Set(prev).add(resultId))
        setSelectedForRealTime(resultId)
      }
    } catch (error) {
      const errorResult: CheckResult = {
        id: resultId,
        url: normalizedUrl,
        status: "down",
        checkedAt: new Date(),
        error: error instanceof Error ? error.message : "Network error",
      }

      setResults((prev) => prev.map((result) => (result.id === resultId ? errorResult : result)))
    } finally {
      setIsChecking(false)
    }
  }

  const toggleRealTimeMonitor = (resultId: string) => {
    setActiveMonitors((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(resultId)) {
        newSet.delete(resultId)
        if (selectedForRealTime === resultId) {
          setSelectedForRealTime(null)
        }
      } else {
        newSet.add(resultId)
        setSelectedForRealTime(resultId)
      }
      return newSet
    })
  }

  const removeResult = (id: string) => {
    setResults((prev) => prev.filter((result) => result.id !== id))
    if (selectedForRealTime === id) {
      setSelectedForRealTime(null)
    }
    setActiveMonitors((prev) => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  const clearAllResults = () => {
    setResults([])
    setSelectedForRealTime(null)
    setActiveMonitors(new Set())
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    checkUrl()
  }

  const getStatusIcon = (status: CheckResult["status"]) => {
    switch (status) {
      case "up":
        return <CheckCircle className="w-5 h-5 text-chart-1" />
      case "down":
        return <XCircle className="w-5 h-5 text-chart-3" />
      case "checking":
        return <Clock className="w-5 h-5 text-muted-foreground animate-pulse" />
    }
  }

  const getStatusBadge = (result: CheckResult) => {
    if (result.status === "checking") {
      return <Badge variant="secondary">Checking...</Badge>
    }

    if (result.status === "up") {
      return (
        <Badge className="bg-chart-1/10 text-chart-1 border-chart-1/20">
          {result.statusCode ? `${result.statusCode} ${result.statusText}` : "Operational"}
        </Badge>
      )
    }

    return (
      <Badge variant="destructive">{result.statusCode ? `${result.statusCode} ${result.statusText}` : "Down"}</Badge>
    )
  }

  const selectedResult = results.find((r) => r.id === selectedForRealTime)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custom URL Checker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              placeholder="Enter website URL (e.g., https://example.com or example.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
              disabled={isChecking}
            />
            <Button type="submit" disabled={isChecking || !url.trim()} className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Check Status
            </Button>
          </form>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Enter any website URL to check its status and response time. Successful checks will automatically start
              real-time monitoring.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {selectedResult && selectedForRealTime && (
        <RealTimeChart
          url={selectedResult.url}
          name={`Custom: ${new URL(selectedResult.url).hostname}`}
          isActive={activeMonitors.has(selectedForRealTime)}
          onToggle={() => toggleRealTimeMonitor(selectedForRealTime)}
        />
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Check Results ({results.length})</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllResults}
                className="flex items-center gap-2 bg-transparent"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result) => (
                <div
                  key={result.id}
                  className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
                    selectedForRealTime === result.id ? "bg-muted border-chart-2" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{result.url}</h3>
                        <ExternalLink
                          className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer flex-shrink-0"
                          onClick={() => window.open(result.url, "_blank")}
                        />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Checked at {result.checkedAt.toLocaleTimeString()}</span>
                        {result.responseTime && <span>{result.responseTime}ms</span>}
                      </div>
                      {result.error && <p className="text-sm text-chart-3 mt-1">{result.error}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(result)}
                    <Button
                      variant={activeMonitors.has(result.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleRealTimeMonitor(result.id)}
                      className="flex items-center gap-1"
                    >
                      <Activity className="w-4 h-4" />
                      {activeMonitors.has(result.id) ? "Stop" : "Monitor"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeResult(result.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
