"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, BookOpen, Search, Sparkles, X } from "lucide-react"
import { BlogCover } from "@/components/blog/blog-cover"
import type { BlogCategory, BlogPost } from "@/lib/blog-types"

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function categoryFor(categories: BlogCategory[], slug: string): BlogCategory {
  return categories.find((category) => category.slug === slug) ?? {
    slug,
    name: slug.replace(/-/g, " "),
    description: "",
  }
}

function PostCard({ post, categories }: { post: BlogPost; categories: BlogCategory[] }) {
  const category = categoryFor(categories, post.category)
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--brand-200)] hover:shadow-xl hover:shadow-orange-950/5"
    >
      <BlogCover accent={post.accent} category={post.category} categoryName={category.name} />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--brand-700)]">
          <span>{category.name}</span>
          <span className="text-border">/</span>
          <span className="font-medium text-muted-foreground">{post.readTime} min read</span>
        </div>
        <h2 className="mt-3 text-xl font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-[color:var(--brand-600)]">
          {post.title}
        </h2>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-6 text-xs text-muted-foreground">
          <span>{formatDate(post.publishedAt)}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            Read article <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export function BlogIndex({
  posts,
  categories,
  initialQuery = "",
  initialCategory = "all",
}: {
  posts: BlogPost[]
  categories: BlogCategory[]
  initialQuery?: string
  initialCategory?: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState(
    initialCategory === "all" || categories.some((item) => item.slug === initialCategory)
      ? initialCategory
      : "all",
  )

  useEffect(() => {
    const id = window.setTimeout(() => {
      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())
      if (category !== "all") params.set("category", category)
      const next = params.toString() ? `/blog?${params.toString()}` : "/blog"
      window.history.replaceState(null, "", next)
    }, 180)
    return () => window.clearTimeout(id)
  }, [query, category])

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: posts.length }
    for (const post of posts) result[post.category] = (result[post.category] ?? 0) + 1
    return result
  }, [posts])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return posts.filter((post) => {
      if (category !== "all" && post.category !== category) return false
      if (!needle) return true
      const categoryName = categoryFor(categories, post.category).name
      return [post.title, post.excerpt, post.author, categoryName]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    })
  }, [category, categories, posts, query])

  const featured =
    category === "all" && !query.trim()
      ? filtered.find((post) => post.featured) ?? filtered[0]
      : filtered[0]
  const remaining = featured ? filtered.filter((post) => post.slug !== featured.slug) : []
  const featuredCategory = featured ? categoryFor(categories, featured.category) : null

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-[color:var(--brand-50)]/80 via-background to-background">
        <div className="absolute inset-0 -z-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fb923c 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-200)] bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--brand-700)] shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> The status.watch journal
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl md:text-6xl">
              Stories from the <span className="text-[color:var(--brand-500)]">reliability</span> front line.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Practical monitoring guides, honest incident reviews, and data-backed lessons for teams that keep the internet running.
            </p>
            <label className="mx-auto mt-8 flex h-12 max-w-xl items-center gap-3 rounded-xl border border-border bg-card px-4 text-left shadow-lg shadow-orange-950/5 focus-within:border-[color:var(--brand-500)] focus-within:ring-4 focus-within:ring-orange-100">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="sr-only">Search articles</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search articles, topics, or authors"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </label>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6 md:py-14">
        <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Blog categories">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${category === "all" ? "border-[color:var(--brand-500)] bg-[color:var(--brand-500)] text-white" : "border-border bg-card text-muted-foreground hover:border-[color:var(--brand-200)] hover:text-foreground"}`}
          >
            All stories <span className="ml-1 opacity-70">{counts.all}</span>
          </button>
          {categories.filter((item) => counts[item.slug]).map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => setCategory(item.slug)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${category === item.slug ? "border-[color:var(--brand-500)] bg-[color:var(--brand-500)] text-white" : "border-border bg-card text-muted-foreground hover:border-[color:var(--brand-200)] hover:text-foreground"}`}
            >
              {item.name} <span className="ml-1 opacity-70">{counts[item.slug]}</span>
            </button>
          ))}
        </div>

        {featured && featuredCategory ? (
          <>
            <div className="mt-10 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--brand-600)]">
                  {query || category !== "all" ? `${filtered.length} matching ${filtered.length === 1 ? "story" : "stories"}` : "Editor’s pick"}
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  {query || category !== "all" ? "Search results" : "Worth your time"}
                </h2>
              </div>
            </div>

            <Link
              href={`/blog/${featured.slug}`}
              className="group mt-6 grid overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all hover:border-[color:var(--brand-200)] hover:shadow-xl hover:shadow-orange-950/5 lg:grid-cols-[1.08fr_0.92fr]"
            >
              <BlogCover accent={featured.accent} category={featured.category} categoryName={featuredCategory.name} large />
              <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-[color:var(--brand-50)] px-2.5 py-1 text-[color:var(--brand-700)]">{featuredCategory.name}</span>
                  <span className="text-muted-foreground">{formatDate(featured.publishedAt)}</span>
                  <span className="text-border">•</span>
                  <span className="text-muted-foreground">{featured.readTime} min read</span>
                </div>
                <h3 className="mt-5 text-3xl font-bold leading-tight tracking-[-0.03em] transition-colors group-hover:text-[color:var(--brand-600)] sm:text-4xl">
                  {featured.title}
                </h3>
                <p className="mt-4 text-base leading-7 text-muted-foreground">{featured.excerpt}</p>
                <div className="mt-8 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
                    {featured.author.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                  </span>
                  <div className="text-sm">
                    <div className="font-semibold">{featured.author}</div>
                    <div className="text-xs text-muted-foreground">{featured.authorRole}</div>
                  </div>
                  <ArrowRight className="ml-auto h-5 w-5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>

            {remaining.length ? (
              <section className="mt-16">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--brand-600)]">Latest thinking</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">More from the journal</h2>
                  </div>
                  <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
                    <BookOpen className="h-4 w-4" /> {filtered.length} articles
                  </div>
                </div>
                <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {remaining.map((post) => <PostCard key={post.slug} post={post} categories={categories} />)}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <div className="mt-12 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
            <Search className="mx-auto h-7 w-7 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-bold">No stories found</h2>
            <p className="mt-2 text-sm text-muted-foreground">Try a different search or choose another category.</p>
            <button type="button" onClick={() => { setQuery(""); setCategory("all") }} className="mt-5 text-sm font-semibold text-[color:var(--brand-600)] hover:underline">
              Clear all filters
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

