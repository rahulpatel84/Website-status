import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { CompanyMonitorPage } from "@/components/company-monitor-page"
import websitesData from "@/data/websites.json"

interface PageProps {
  params: {
    company: string
  }
}

interface Website {
  id: string
  name: string
  url: string
  category: string
  description?: string
  founded?: string
  headquarters?: string
}

export async function generateStaticParams() {
  return websitesData.websites.map((website) => ({
    company: website.id + "-website-monitor",
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const companyId = params.company.replace("-website-monitor", "")
  const website = websitesData.websites.find((w) => w.id === companyId) as Website | undefined

  if (!website) {
    return {
      title: "Website Not Found",
    }
  }

  return {
    title: `${website.name} Website Monitor - Real-time Status & Performance`,
    description:
      website.description ||
      `Monitor ${website.name} (${website.url}) in real-time. Track uptime, response times, and performance metrics with live charts and alerts.`,
    keywords: [`${website.name} status`, "website monitoring", "uptime tracking", "performance monitoring"],
    openGraph: {
      title: `${website.name} Website Monitor`,
      description: website.description || `Real-time monitoring for ${website.name}`,
      type: "website",
    },
  }
}

export default function CompanyMonitorPageRoute({ params }: PageProps) {
  const companyId = params.company.replace("-website-monitor", "")
  const website = websitesData.websites.find((w) => w.id === companyId) as Website | undefined

  if (!website) {
    notFound()
  }

  return <CompanyMonitorPage website={website} />
}
