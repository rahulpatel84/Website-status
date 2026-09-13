"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileEdit,
  FilePlus2,
  FolderOpen,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react"
import type { BlogCategory, BlogPost } from "@/lib/blog-types"

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function categoryName(categories: BlogCategory[], slug: string): string {
  return categories.find((category) => category.slug === slug)?.name ?? slug.replace(/-/g, " ")
}

export function BlogCmsList({
  initialPosts,
  categories,
}: {
  initialPosts: BlogPost[]
  categories: BlogCategory[]
}) {
  const [posts, setPosts] = useState(initialPosts)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [category, setCategory] = useState("all")
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return posts.filter((post) => {
      if (status !== "all" && post.status !== status) return false
      if (category !== "all" && post.category !== category) return false
      return !needle || [post.title, post.excerpt, post.author, post.slug].join(" ").toLowerCase().includes(needle)
    })
  }, [category, posts, query, status])

  const publishedCount = posts.filter((post) => post.status === "published").length
  const draftCount = posts.filter((post) => post.status === "draft").length

  async function updateStatus(post: BlogPost) {
    setBusySlug(post.slug)
    setMessage(null)
    try {
      const nextStatus = post.status === "published" ? "draft" : "published"
      const response = await fetch(`/api/blog/${encodeURIComponent(post.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...post, status: nextStatus }),
      })
      const payload = (await response.json()) as { post?: BlogPost; error?: string }
      if (!response.ok || !payload.post) throw new Error(payload.error || "Unable to update article")
      setPosts((current) => current.map((item) => item.slug === post.slug ? payload.post! : item))
      setMessage(nextStatus === "published" ? "Article published." : "Article moved to drafts.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update article")
    } finally {
      setBusySlug(null)
    }
  }

  async function removePost(post: BlogPost) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return
    setBusySlug(post.slug)
    setMessage(null)
    try {
      const response = await fetch(`/api/blog/${encodeURIComponent(post.slug)}`, { method: "DELETE" })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error || "Unable to delete article")
      setPosts((current) => current.filter((item) => item.slug !== post.slug))
      setMessage("Article deleted.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete article")
    } finally {
      setBusySlug(null)
    }
  }

  const stats = [
    { label: "Total articles", value: posts.length, icon: BookOpen },
    { label: "Published", value: publishedCount, icon: CheckCircle2 },
    { label: "Drafts", value: draftCount, icon: Clock3 },
    { label: "Categories", value: categories.length, icon: FolderOpen },
  ]

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--brand-600)]">
            <Sparkles className="h-3.5 w-3.5" /> Content studio
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Blog CMS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Write, organise, and publish the status.watch journal from one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/blog" target="_blank" className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold hover:bg-muted">
            View blog <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link href="/app/blog/new" className="inline-flex h-9 items-center gap-2 rounded-md bg-[color:var(--brand-500)] px-4 text-sm font-semibold text-white hover:bg-[color:var(--brand-600)]">
            <FilePlus2 className="h-4 w-4" /> New article
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{item.label}</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--brand-50)] text-[color:var(--brand-700)]">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold">{item.value}</div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:border-[color:var(--brand-500)]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Search articles</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, author, or slug" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm">
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-sm">
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-lg border border-[color:var(--brand-200)] bg-[color:var(--brand-50)] px-4 py-3 text-sm font-medium text-[color:var(--brand-700)]">
          {message}
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="hidden grid-cols-[minmax(0,1fr)_140px_110px_110px_164px] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
          <div>Article</div><div>Category</div><div>Status</div><div>Updated</div><div className="text-right">Actions</div>
        </div>
        {filtered.length ? filtered.map((post) => (
          <div key={post.slug} className="grid gap-3 border-b border-border px-4 py-4 last:border-0 hover:bg-muted/20 md:grid-cols-[minmax(0,1fr)_140px_110px_110px_164px] md:items-center md:gap-4 md:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/app/blog/${post.slug}/edit`} className="truncate text-sm font-semibold hover:text-[color:var(--brand-600)]">{post.title}</Link>
                {post.featured ? <span className="shrink-0 rounded-full bg-[color:var(--brand-50)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--brand-700)]">Featured</span> : null}
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">/blog/{post.slug} · {post.readTime} min read</div>
            </div>
            <div className="text-xs font-medium capitalize text-muted-foreground">{categoryName(categories, post.category)}</div>
            <div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${post.status === "published" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${post.status === "published" ? "bg-green-500" : "bg-amber-500"}`} />
                {post.status === "published" ? "Published" : "Draft"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">{formatDate(post.updatedAt)}</div>
            <div className="flex items-center gap-1 md:justify-end">
              {post.status === "published" ? (
                <Link href={`/blog/${post.slug}`} target="_blank" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`View ${post.title}`}>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              ) : null}
              <button type="button" disabled={busySlug === post.slug} onClick={() => updateStatus(post)} className="h-8 rounded-md border border-border px-2.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-50">
                {post.status === "published" ? "Unpublish" : "Publish"}
              </button>
              <Link href={`/app/blog/${post.slug}/edit`} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Edit ${post.title}`}>
                <FileEdit className="h-4 w-4" />
              </Link>
              <button type="button" disabled={busySlug === post.slug} onClick={() => removePost(post)} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50" aria-label={`Delete ${post.title}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )) : (
          <div className="px-6 py-14 text-center">
            <Search className="mx-auto h-7 w-7 text-muted-foreground" />
            <div className="mt-3 text-sm font-semibold">No matching articles</div>
            <p className="mt-1 text-xs text-muted-foreground">Try clearing one of the filters above.</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Content is stored in <code className="rounded bg-muted px-1.5 py-0.5 font-mono">data/blog-content.json</code> and can also be edited directly.
      </p>
    </div>
  )
}

