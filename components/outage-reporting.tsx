"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Smartphone, Globe, Code, CreditCard, LogIn, MoreHorizontal, CheckCircle } from "lucide-react"

interface OutageReportingProps {
  companyName: string
  companySlug: string
}

const BRAND_TILE =
  "bg-[color:var(--brand-50)] text-[color:var(--brand-700)] hover:bg-[color:var(--brand-100)] ring-1 ring-[color:var(--brand-200)]"
const NEUTRAL_TILE =
  "bg-card text-foreground hover:bg-muted ring-1 ring-border"

const issueTypes = [
  { id: "website", label: "Website", icon: Globe, color: BRAND_TILE },
  { id: "services", label: "Services", icon: AlertTriangle, color: BRAND_TILE },
  { id: "api", label: "API", icon: Code, color: BRAND_TILE },
  { id: "mobile-app", label: "Mobile App", icon: Smartphone, color: BRAND_TILE },
  { id: "payment-system", label: "Payment", icon: CreditCard, color: BRAND_TILE },
  { id: "login", label: "Login", icon: LogIn, color: BRAND_TILE },
  { id: "other", label: "Something else…", icon: MoreHorizontal, color: NEUTRAL_TILE },
]

export function OutageReporting({ companyName, companySlug }: OutageReportingProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)

  const handleReport = async (issueType: string) => {
    setIsSubmitting(true)

    // LOG: User clicked report button
    const localTime = new Date()
    console.log(`🔴 USER CLICKED REPORT BUTTON:`)
    console.log(`Company: ${companySlug}`)
    console.log(`Issue Type: ${issueType}`)
    console.log(`Local Time: ${localTime.toLocaleString()} (${localTime.toISOString()})`)
    console.log(`Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`)
    console.log(`Timezone Offset: ${localTime.getTimezoneOffset()} minutes`)

    try {
      // Try to get user's public IP (best-effort, non-blocking fallback after 1s)
      let clientIP: string | null = null
      try {
        const ipResp = await Promise.race([
          fetch('https://api.ipify.org?format=json', { cache: 'no-store' }),
          new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('ip timeout')), 1200)) as unknown as Promise<Response>
        ])
        if (ipResp && ipResp.ok) {
          const ipJson = await ipResp.json()
          clientIP = ipJson?.ip || null
        }
      } catch {}

      const response = await fetch("/api/report-outage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companySlug,
          issueType,
          clientTimestamp: localTime.toISOString(), // Send client timestamp for debugging
          clientIP,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`✅ REPORT SUBMITTED SUCCESSFULLY:`, result)
        
        setSubmitted(issueType)
        setTimeout(() => setSubmitted(null), 3000) // Clear after 3 seconds
        
        // Dispatch a custom event to refresh charts
        window.dispatchEvent(new CustomEvent('outageReported', { 
          detail: { companySlug, issueType } 
        }))
      } else {
        console.error(`❌ REPORT SUBMISSION FAILED:`, response.status, await response.text())
      }
    } catch (error) {
      console.error("❌ FAILED TO REPORT OUTAGE:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="w-5 h-5 text-[color:var(--brand-500)]" /> I have a problem with {companyName}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select the category that best matches — your report is anonymous and helps others confirm the outage.
        </p>
      </CardHeader>
      <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-3">
          {issueTypes.map((issue) => {
            const Icon = issue.icon
            const isSubmitted = submitted === issue.id

            return (
              <Button
                key={issue.id}
                variant="outline"
                        className={`min-h-16 px-3 py-3 md:px-4 md:py-4 flex flex-col items-center gap-1 md:gap-2 rounded-lg border-0 ${
                          isSubmitted
                            ? "bg-green-50 text-[color:var(--status-up)] ring-1 ring-green-200"
                            : issue.color
                } transition-colors`}
                onClick={() => handleReport(issue.id)}
                disabled={isSubmitting || isSubmitted}
              >
                        {isSubmitted ? <CheckCircle className="w-5 h-5 md:w-6 md:h-6" /> : <Icon className="w-5 h-5 md:w-6 md:h-6" />}
                        <span className="text-xs md:text-sm font-medium text-center">{isSubmitted ? "Reported!" : issue.label}</span>
              </Button>
            )
          })}
        </div>

        {submitted && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              Thanks — your report was recorded. It's helping others confirm the outage right now.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
