import { EventEmitter } from "events"

// Singleton emitter to broadcast server-side events (e.g., new outage report)
class OutageEventBus extends EventEmitter {}

// Ensure a single instance across hot reloads in dev
// @ts-ignore
const globalAny = global as any
export const outageEvents: OutageEventBus = globalAny.__OUTAGE_EVENTS__ || new OutageEventBus()
// @ts-ignore
if (!globalAny.__OUTAGE_EVENTS__) {
  // Avoid MaxListeners warnings for many SSE clients
  outageEvents.setMaxListeners(0)
  globalAny.__OUTAGE_EVENTS__ = outageEvents
}

export interface OutageReportedPayload {
  companySlug: string
  issueType: string
  city?: string | null
  state?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  created_at?: string
}

export interface CommentNewPayload {
  companySlug: string
  comment: {
    id: number
    company_slug: string
    issue_type: string | null
    nickname: string | null
    location: string | null
    body: string
    parent_id: number | null
    upvotes: number
    status: string
    created_at: string
  }
}

export interface CommentVotePayload {
  companySlug: string
  commentId: number
  upvotes: number
}


