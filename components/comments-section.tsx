"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Flag, MessageSquare, Send, TriangleAlert } from "lucide-react"

interface Comment {
  id: number
  company_slug: string
  issue_type: string | null
  nickname: string | null
  location: string | null
  body: string
  parent_id: number | null
  upvotes: number
  status: string
  flag_count?: number
  created_at: string
}

interface CommentWithReplies extends Comment {
  replies: Comment[]
}

interface CommentsSectionProps {
  companySlug: string
  companyName: string
}

const ISSUE_TYPES: Array<{ id: string; label: string }> = [
  { id: "login", label: "Login" },
  { id: "feed", label: "Feed" },
  { id: "api", label: "API" },
  { id: "mobile", label: "Mobile" },
  { id: "payment", label: "Payment" },
  { id: "other", label: "Other" },
]

const VOTED_KEY = "sw:voted"
const FLAGGED_KEY = "sw:flagged"

function readIdSet(key: string): Set<number> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n)))
  } catch {}
  return new Set()
}

function writeIdSet(key: string, set: Set<number>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(set)))
  } catch {}
}

function timeAgo(iso: string): string {
  const t = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso.replace(" ", "T") + "Z").getTime()
  if (Number.isNaN(t)) return ""
  const diff = Math.max(0, Date.now() - t)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

function avatarLetter(nickname: string | null): string {
  if (!nickname) return "?"
  const c = nickname.trim().charAt(0)
  return c ? c.toUpperCase() : "?"
}

function IssueTypePill({ type }: { type: string | null }) {
  if (!type) return null
  const label = ISSUE_TYPES.find((t) => t.id === type)?.label ?? type
  return (
    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
      {label}
    </Badge>
  )
}

export function CommentsSection({ companySlug, companyName }: CommentsSectionProps) {
  const [comments, setComments] = useState<CommentWithReplies[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Composer state
  const [nickname, setNickname] = useState("")
  const [issueType, setIssueType] = useState<string>("")
  const [bodyText, setBodyText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Reply composer state — mapping parent id -> draft
  const [replyOpenFor, setReplyOpenFor] = useState<number | null>(null)
  const [replyText, setReplyText] = useState("")
  const [replySubmitting, setReplySubmitting] = useState(false)

  // Voted / flagged ids persisted in localStorage
  const [voted, setVoted] = useState<Set<number>>(new Set())
  const [flagged, setFlagged] = useState<Set<number>>(new Set())

  const esRef = useRef<EventSource | null>(null)

  // Load initial comments + hydrate voted/flagged from localStorage
  useEffect(() => {
    setVoted(readIdSet(VOTED_KEY))
    setFlagged(readIdSet(FLAGGED_KEY))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/comments?company=${encodeURIComponent(companySlug)}&limit=100`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load comments")
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setComments(Array.isArray(data.comments) ? data.comments : [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || "Failed to load comments")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [companySlug])

  // Subscribe to SSE
  useEffect(() => {
    const url = `/api/events?company=${encodeURIComponent(companySlug)}`
    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener("comment.new", (evt: MessageEvent) => {
      try {
        const payload = JSON.parse(evt.data) as { companySlug: string; comment: Comment }
        if (payload.companySlug !== companySlug) return
        setComments((prev) => {
          // Skip duplicates
          if (payload.comment.parent_id) {
            return prev.map((p) =>
              p.id === payload.comment.parent_id
                ? p.replies.some((r) => r.id === payload.comment.id)
                  ? p
                  : { ...p, replies: [...p.replies, payload.comment] }
                : p,
            )
          }
          if (prev.some((c) => c.id === payload.comment.id)) return prev
          return [{ ...payload.comment, replies: [] }, ...prev]
        })
      } catch {}
    })

    es.addEventListener("comment.vote", (evt: MessageEvent) => {
      try {
        const payload = JSON.parse(evt.data) as { companySlug: string; commentId: number; upvotes: number }
        if (payload.companySlug !== companySlug) return
        setComments((prev) =>
          prev.map((p) => {
            if (p.id === payload.commentId) return { ...p, upvotes: payload.upvotes }
            if (p.replies.some((r) => r.id === payload.commentId)) {
              return {
                ...p,
                replies: p.replies.map((r) =>
                  r.id === payload.commentId ? { ...r, upvotes: payload.upvotes } : r,
                ),
              }
            }
            return p
          }),
        )
      } catch {}
    })

    es.onerror = () => {
      // Let the browser auto-reconnect
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [companySlug])

  const remaining = 280 - bodyText.length
  const canSubmit = bodyText.trim().length > 0 && bodyText.trim().length <= 280 && !submitting

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug,
          issueType: issueType || undefined,
          nickname: nickname.trim() || undefined,
          body: bodyText,
        }),
      })
      if (res.status === 429) {
        setError("You're posting too fast. Try again in a minute.")
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j?.error || "Failed to post comment")
        return
      }
      const data = (await res.json()) as { comment: CommentWithReplies }
      // If it wasn't broadcast (e.g. hidden due to moderation), still prepend so the poster sees feedback.
      setComments((prev) => {
        if (prev.some((c) => c.id === data.comment.id)) return prev
        return [data.comment, ...prev]
      })
      setBodyText("")
      setIssueType("")
    } catch (err: any) {
      setError(err?.message || "Failed to post comment")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReplySubmit = async (parentId: number) => {
    const draft = replyText.trim()
    if (!draft || draft.length > 280) return
    setReplySubmitting(true)
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug,
          nickname: nickname.trim() || undefined,
          body: draft,
          parentId,
        }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { comment: Comment }
      setComments((prev) =>
        prev.map((p) =>
          p.id === parentId
            ? p.replies.some((r) => r.id === data.comment.id)
              ? p
              : { ...p, replies: [...p.replies, data.comment] }
            : p,
        ),
      )
      setReplyText("")
      setReplyOpenFor(null)
    } finally {
      setReplySubmitting(false)
    }
  }

  const handleVote = async (commentId: number) => {
    if (voted.has(commentId)) return
    // Optimistic increment
    setComments((prev) =>
      prev.map((p) => {
        if (p.id === commentId) return { ...p, upvotes: p.upvotes + 1 }
        if (p.replies.some((r) => r.id === commentId)) {
          return {
            ...p,
            replies: p.replies.map((r) => (r.id === commentId ? { ...r, upvotes: r.upvotes + 1 } : r)),
          }
        }
        return p
      }),
    )
    const nextVoted = new Set(voted)
    nextVoted.add(commentId)
    setVoted(nextVoted)
    writeIdSet(VOTED_KEY, nextVoted)

    try {
      const res = await fetch("/api/comments/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      })
      if (!res.ok) throw new Error("vote failed")
      const data = (await res.json()) as { upvotes: number }
      setComments((prev) =>
        prev.map((p) => {
          if (p.id === commentId) return { ...p, upvotes: data.upvotes }
          if (p.replies.some((r) => r.id === commentId)) {
            return {
              ...p,
              replies: p.replies.map((r) => (r.id === commentId ? { ...r, upvotes: data.upvotes } : r)),
            }
          }
          return p
        }),
      )
    } catch {
      // Revert
      setComments((prev) =>
        prev.map((p) => {
          if (p.id === commentId) return { ...p, upvotes: Math.max(0, p.upvotes - 1) }
          if (p.replies.some((r) => r.id === commentId)) {
            return {
              ...p,
              replies: p.replies.map((r) =>
                r.id === commentId ? { ...r, upvotes: Math.max(0, r.upvotes - 1) } : r,
              ),
            }
          }
          return p
        }),
      )
      const reverted = new Set(voted)
      reverted.delete(commentId)
      setVoted(reverted)
      writeIdSet(VOTED_KEY, reverted)
    }
  }

  const handleFlag = async (commentId: number) => {
    if (flagged.has(commentId)) return
    const nextFlagged = new Set(flagged)
    nextFlagged.add(commentId)
    setFlagged(nextFlagged)
    writeIdSet(FLAGGED_KEY, nextFlagged)

    try {
      await fetch("/api/comments/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      })
    } catch {
      // best-effort; keep marked
    }
  }

  const isEmpty = !loading && comments.length === 0

  const composerRows = useMemo(
    () => (
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            placeholder="Nickname (optional)"
            aria-label="Nickname"
          />
          <select
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            aria-label="Issue type"
          >
            <option value="">Issue type (optional)</option>
            {ISSUE_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value.slice(0, 280))}
            placeholder={`What's going on with ${companyName}?`}
            className="w-full min-h-[88px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y"
            maxLength={280}
            aria-label="Comment body"
          />
          <div
            className={`absolute bottom-2 right-3 text-[11px] ${
              remaining < 20 ? "text-[color:var(--status-down)]" : "text-muted-foreground"
            }`}
          >
            {remaining}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">Auto-detected from your IP</p>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-[color:var(--status-down)]">{error}</span>}
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      </form>
    ),
    [nickname, issueType, bodyText, remaining, canSubmit, submitting, error, companyName],
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[color:var(--brand-500)]" />
            Live reports & comments
          </CardTitle>
          <div className="inline-flex items-center gap-2 text-xs bg-[color:var(--brand-50)] text-foreground border border-border rounded-full px-3 py-1">
            <span className="status-dot status-up" />
            Live · updates in realtime
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {composerRows}

        {loading && <p className="text-sm text-muted-foreground">Loading comments...</p>}

        {isEmpty && (
          <div className="rounded-lg border border-border bg-[color:var(--brand-50)] p-6 text-center">
            <p className="text-sm text-foreground">
              Be the first to report an issue with <span className="font-medium">{companyName}</span>.
            </p>
          </div>
        )}

        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-4">
              <CommentHeader
                nickname={c.nickname}
                issueType={c.issue_type}
                location={c.location}
                createdAt={c.created_at}
              />
              <p className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words">{c.body}</p>
              <div className="mt-3 flex items-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => handleVote(c.id)}
                  disabled={voted.has(c.id)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 border border-border transition-colors ${
                    voted.has(c.id)
                      ? "bg-[color:var(--brand-50)] text-[color:var(--brand-600)] cursor-default"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  aria-label="Same here (upvote)"
                >
                  <span aria-hidden>▲</span>
                  Same here · {c.upvotes}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplyOpenFor(replyOpenFor === c.id ? null : c.id)
                    setReplyText("")
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => handleFlag(c.id)}
                  disabled={flagged.has(c.id)}
                  className={`inline-flex items-center gap-1 ${
                    flagged.has(c.id) ? "text-muted-foreground cursor-default" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Flag className="w-3 h-3" />
                  {flagged.has(c.id) ? "You flagged this" : "Flag"}
                </button>
              </div>

              {replyOpenFor === c.id && (
                <div className="mt-3 space-y-2 border-l-2 border-[color:var(--brand-200)] pl-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value.slice(0, 280))}
                    placeholder="Write a reply..."
                    maxLength={280}
                    className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y"
                    aria-label="Reply body"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReplyOpenFor(null)
                        setReplyText("")
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleReplySubmit(c.id)}
                      disabled={!replyText.trim() || replySubmitting}
                      className="bg-[color:var(--brand-500)] hover:bg-[color:var(--brand-600)] text-white"
                    >
                      {replySubmitting ? "Replying..." : "Reply"}
                    </Button>
                  </div>
                </div>
              )}

              {c.replies.length > 0 && (
                <ul className="mt-4 space-y-3 border-l-2 border-border pl-3">
                  {c.replies.map((r) => (
                    <li key={r.id} className="rounded-md bg-background p-3 border border-border">
                      <CommentHeader
                        nickname={r.nickname}
                        issueType={r.issue_type}
                        location={r.location}
                        createdAt={r.created_at}
                      />
                      <p className="mt-2 text-sm text-foreground whitespace-pre-wrap break-words">{r.body}</p>
                      <div className="mt-2 flex items-center gap-4 text-xs">
                        <button
                          type="button"
                          onClick={() => handleVote(r.id)}
                          disabled={voted.has(r.id)}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 border border-border transition-colors ${
                            voted.has(r.id)
                              ? "bg-[color:var(--brand-50)] text-[color:var(--brand-600)] cursor-default"
                              : "hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          <span aria-hidden>▲</span>
                          Same here · {r.upvotes}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFlag(r.id)}
                          disabled={flagged.has(r.id)}
                          className={`inline-flex items-center gap-1 ${
                            flagged.has(r.id)
                              ? "text-muted-foreground cursor-default"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Flag className="w-3 h-3" />
                          {flagged.has(r.id) ? "You flagged this" : "Flag"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>

        {error && !submitting && (
          <div className="flex items-center gap-2 text-xs text-[color:var(--status-down)]">
            <TriangleAlert className="w-3 h-3" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CommentHeader({
  nickname,
  issueType,
  location,
  createdAt,
}: {
  nickname: string | null
  issueType: string | null
  location: string | null
  createdAt: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 shrink-0 rounded-full bg-[color:var(--brand-50)] text-[color:var(--brand-600)] border border-[color:var(--brand-200)] flex items-center justify-center text-sm font-semibold">
        {avatarLetter(nickname)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-foreground">{nickname || "Anonymous"}</span>
          <IssueTypePill type={issueType} />
          {location && <span className="text-muted-foreground">· {location}</span>}
          <span className="text-muted-foreground">· {timeAgo(createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

export default CommentsSection
