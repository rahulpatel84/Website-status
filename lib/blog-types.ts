export const BLOG_STATUSES = ["draft", "published"] as const
export const BLOG_ACCENTS = ["orange", "amber", "emerald", "blue", "violet", "slate"] as const

export type BlogStatus = (typeof BLOG_STATUSES)[number]
export type BlogAccent = (typeof BLOG_ACCENTS)[number]

export interface BlogCategory {
  slug: string
  name: string
  description: string
}

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  category: string
  author: string
  authorRole: string
  publishedAt: string
  updatedAt: string
  status: BlogStatus
  featured: boolean
  readTime: number
  accent: BlogAccent
  seoTitle: string
  seoDescription: string
  body: string
}

export interface BlogStore {
  categories: BlogCategory[]
  posts: BlogPost[]
}

export interface BlogPostInput {
  slug?: unknown
  title?: unknown
  excerpt?: unknown
  category?: unknown
  categoryName?: unknown
  author?: unknown
  authorRole?: unknown
  publishedAt?: unknown
  status?: unknown
  featured?: unknown
  accent?: unknown
  seoTitle?: unknown
  seoDescription?: unknown
  body?: unknown
}

