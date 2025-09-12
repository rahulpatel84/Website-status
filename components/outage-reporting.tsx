"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Smartphone, Globe, Code, CreditCard, LogIn, MoreHorizontal, CheckCircle } from "lucide-react"

interface OutageReportingProps {
  companyName: string
  companySlug: string
}

const issueTypes = [
  { id: "website", label: "Website", icon: Globe, color: "bg-red-500 hover:bg-red-600" },
  { id: "services", label: "Services", icon: AlertTriangle, color: "bg-red-500 hover:bg-red-600" },
  { id: "api", label: "API", icon: Code, color: "bg-red-500 hover:bg-red-600" },
  { id: "mobile-app", label: "Mobile App", icon: Smartphone, color: "bg-red-500 hover:bg-red-600" },
  { id: "payment-system", label: "Payment System", icon: CreditCard, color: "bg-red-500 hover:bg-red-600" },
  { id: "login", label: "Login", icon: LogIn, color: "bg-red-500 hover:bg-red-600" },
  { id: "other", label: "Something else...", icon: MoreHorizontal, color: "bg-gray-500 hover:bg-gray-600" },
]

export function OutageReporting({ companyName, companySlug }: OutageReportingProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)

  const handleReport = async (issueType: string) => {
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/report-outage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companySlug,
          issueType,
        }),
      })

      if (response.ok) {
        setSubmitted(issueType)
        setTimeout(() => setSubmitted(null), 3000) // Clear after 3 seconds
      }
    } catch (error) {
      console.error("Failed to report outage:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />I have a problem with {companyName}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select the option you are having issues with and help provide feedback to the service.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {issueTypes.map((issue) => {
            const Icon = issue.icon
            const isSubmitted = submitted === issue.id

            return (
              <Button
                key={issue.id}
                variant="outline"
                className={`h-auto p-4 flex flex-col items-center gap-2 text-white border-0 ${
                  isSubmitted ? "bg-green-500 hover:bg-green-600" : issue.color
                } transition-colors`}
                onClick={() => handleReport(issue.id)}
                disabled={isSubmitting || isSubmitted}
              >
                {isSubmitted ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                <span className="text-sm font-medium text-center">{isSubmitted ? "Reported!" : issue.label}</span>
              </Button>
            )
          })}
        </div>

        {submitted && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              Thank you for reporting this issue. Your feedback helps us track service problems.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
