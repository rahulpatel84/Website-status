import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"
import {
  BLOG_ACCENTS,
  BLOG_STATUSES,
  type BlogAccent,
  type BlogCategory,
  type BlogPost,
  type BlogPostInput,
  type BlogStatus,
  type BlogStore,
} from "@/lib/blog-types"

const BLOG_CONTENT_PATH = path.join(process.cwd(), "data", "blog-content.json")

let writeQueue: Promise<unknown> = Promise.resolve()

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback
}

export function slugifyBlogValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
}

export function estimateBlogReadTime(body: string): number {
  const words = body.replace(/[#>*_`\-[\]()]/g, " ").trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 220))
}

function normalizeDate(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

function normalizeCategory(value: unknown): BlogCategory | null {
  if (!isRecord(value)) return null
  const name = text(value.name)
  const slug = slugifyBlogValue(text(value.slug) || name)
  if (!name || !slug) return null
  return {
    slug,
    name,
    description: text(value.description),
  }
}

function normalizePost(value: unknown): BlogPost | null {
  if (!isRecord(value)) return null
  const title = text(value.title)
  const slug = slugifyBlogValue(text(value.slug) || title)
  const body = typeof value.body === "string" ? value.body.trim() : ""
  if (!title || !slug) return null

  const now = new Date().toISOString()
  const rawStatus = text(value.status)
  const status: BlogStatus = (BLOG_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as BlogStatus)
    : "draft"
  const rawAccent = text(value.accent)
  const accent: BlogAccent = (BLOG_ACCENTS as readonly string[]).includes(rawAccent)
    ? (rawAccent as BlogAccent)
    : "orange"

  return {
    slug,
    title,
    excerpt: text(value.excerpt),
    category: slugifyBlogValue(text(value.category)) || "product",
    author: text(value.author, "status.watch team"),
    authorRole: text(value.authorRole, "Editorial team"),
    publishedAt: normalizeDate(value.publishedAt, now),
    updatedAt: normalizeDate(value.updatedAt, now),
    status,
    featured: value.featured === true,
    readTime:
      typeof value.readTime === "number" && Number.isFinite(value.readTime)
        ? Math.max(1, Math.round(value.readTime))
        : estimateBlogReadTime(body),
    accent,
    seoTitle: text(value.seoTitle, title),
    seoDescription: text(value.seoDescription, text(value.excerpt)),
    body,
  }
}

function normalizeStore(value: unknown): BlogStore {
  const record = isRecord(value) ? value : {}
  const categories = Array.isArray(record.categories)
    ? record.categories.map(normalizeCategory).filter((item): item is BlogCategory => Boolean(item))
    : []
  const posts = Array.isArray(record.posts)
    ? record.posts.map(normalizePost).filter((item): item is BlogPost => Boolean(item))
    : []
  return { categories, posts }
}

export async function readBlogStore(): Promise<BlogStore> {
  const raw = await fs.readFile(BLOG_CONTENT_PATH, "utf8")
  return normalizeStore(JSON.parse(raw) as unknown)
}

async function writeBlogStore(store: BlogStore): Promise<void> {
  const tempPath = `${BLOG_CONTENT_PATH}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(store, null, 2) + "\n", "utf8")
  await fs.rename(tempPath, BLOG_CONTENT_PATH)
}

export async function updateBlogStore(
  update: (store: BlogStore) => BlogStore | void,
): Promise<BlogStore> {
  const operation = writeQueue.then(async () => {
    const current = await readBlogStore()
    const next = update(current) ?? current
    await writeBlogStore(next)
    return next
  })
  writeQueue = operation.catch(() => undefined)
  return operation
}

export function publishedBlogPosts(store: BlogStore): BlogPost[] {
  return store.posts
    .filter((post) => post.status === "published" && new Date(post.publishedAt).getTime() <= Date.now())
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}

export function findBlogPost(store: BlogStore, slug: string): BlogPost | undefined {
  return store.posts.find((post) => post.slug === slug)
}

export function findBlogCategory(
  store: Pick<BlogStore, "categories">,
  slug: string,
): BlogCategory {
  return (
    store.categories.find((category) => category.slug === slug) ?? {
      slug,
      name: slug
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
      description: "",
    }
  )
}

export function formatBlogDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

export function createBlogPostFromInput(
  input: BlogPostInput,
  options: { existing?: BlogPost; fallbackAuthor: string },
): BlogPost {
  const existing = options.existing
  const title = text(input.title, existing?.title)
  const slug = slugifyBlogValue(text(input.slug) || title || existing?.slug || "")
  const excerpt = text(input.excerpt, existing?.excerpt)
  const body = typeof input.body === "string" ? input.body.trim() : existing?.body ?? ""
  const category = slugifyBlogValue(text(input.category, existing?.category))

  if (!title) throw new Error("Title is required")
  if (!slug) throw new Error("A valid slug is required")
  if (!excerpt) throw new Error("Excerpt is required")
  if (!category) throw new Error("Category is required")
  if (!body) throw new Error("Article body is required")
  if (title.length > 160) throw new Error("Title must be 160 characters or fewer")
  if (excerpt.length > 360) throw new Error("Excerpt must be 360 characters or fewer")

  const rawStatus = text(input.status, existing?.status ?? "draft")
  const status: BlogStatus = (BLOG_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as BlogStatus)
    : "draft"
  const rawAccent = text(input.accent, existing?.accent ?? "orange")
  const accent: BlogAccent = (BLOG_ACCENTS as readonly string[]).includes(rawAccent)
    ? (rawAccent as BlogAccent)
    : "orange"
  const now = new Date().toISOString()

  return {
    slug,
    title,
    excerpt,
    category,
    author: text(input.author, existing?.author ?? options.fallbackAuthor),
    authorRole: text(input.authorRole, existing?.authorRole ?? "Editorial team"),
    publishedAt: normalizeDate(input.publishedAt, existing?.publishedAt ?? now),
    updatedAt: now,
    status,
    featured: typeof input.featured === "boolean" ? input.featured : existing?.featured ?? false,
    readTime: estimateBlogReadTime(body),
    accent,
    seoTitle: text(input.seoTitle, existing?.seoTitle ?? title),
    seoDescription: text(input.seoDescription, existing?.seoDescription ?? excerpt),
    body,
  }
}

export function ensureBlogCategory(
  store: BlogStore,
  slug: string,
  suppliedName?: unknown,
): void {
  if (store.categories.some((category) => category.slug === slug)) return
  const fallbackName = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
  store.categories.push({
    slug,
    name: text(suppliedName, fallbackName),
    description: "",
  })
}

