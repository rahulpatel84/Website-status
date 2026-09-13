// Blob storage adapter for probe screenshots and other binary artifacts.
// Local dev writes to public/probe-shots/ so Next serves them as static assets;
// production uses Vercel Blob (BLOB_READ_WRITE_TOKEN) or Supabase Storage
// (SUPABASE_STORAGE_BUCKET) so files persist across serverless invocations.
//
// **Status:** Wiring + env detection. Set BLOB_READ_WRITE_TOKEN on Vercel and
// this drops in transparently — nothing else in the app changes.
import { promises as fs } from "node:fs"
import path from "node:path"

export type BlobMode = "local" | "vercel-blob" | "supabase-storage"

export function blobMode(): BlobMode {
  const forced = process.env.BLOB_MODE?.toLowerCase()
  if (forced === "local") return "local"
  if (forced === "vercel-blob") return "vercel-blob"
  if (forced === "supabase-storage") return "supabase-storage"
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob"
  if (process.env.SUPABASE_STORAGE_BUCKET) return "supabase-storage"
  return "local"
}

export interface BlobUploadResult {
  /** Public URL (or path) callers should store in the DB and render in the UI. */
  url: string
  /** Provider-specific ID used later for deletion. */
  key: string
  size: number
}

const LOCAL_ROOT = path.join(process.cwd(), "public", "probe-shots")

export async function putBlob(
  key: string,
  bytes: Uint8Array | Buffer,
  opts: { contentType?: string } = {},
): Promise<BlobUploadResult> {
  const mode = blobMode()
  const size = bytes.byteLength

  if (mode === "vercel-blob") {
    // Lazy-import so we don't fail on deployments where @vercel/blob isn't
    // installed yet. Callers get a clear error only when they actually try
    // to upload without the package.
    // @ts-expect-error — optional peer dep, install `@vercel/blob` when deploying to Vercel Blob
    const { put } = await import("@vercel/blob").catch(() => {
      throw new Error(
        "BLOB_MODE=vercel-blob but @vercel/blob is not installed. Run `npm i @vercel/blob`.",
      )
    })
    const res = await put(key, bytes, {
      access: "public",
      contentType: opts.contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return { url: res.url, key: res.pathname, size }
  }

  if (mode === "supabase-storage") {
    const { supabase } = await import("./db-adapter")
    const bucket = process.env.SUPABASE_STORAGE_BUCKET
    if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET missing")
    const { data, error } = await supabase()
      .storage.from(bucket)
      .upload(key, bytes, { contentType: opts.contentType, upsert: true })
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`)
    const {
      data: { publicUrl },
    } = supabase().storage.from(bucket).getPublicUrl(data.path)
    return { url: publicUrl, key: data.path, size }
  }

  // local
  const abs = path.join(LOCAL_ROOT, key)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, bytes)
  return { url: `/probe-shots/${key}`, key, size }
}

export async function deleteBlob(key: string): Promise<void> {
  const mode = blobMode()
  if (mode === "vercel-blob") {
    // @ts-expect-error — optional peer dep, install `@vercel/blob` when deploying to Vercel Blob
    const { del } = await import("@vercel/blob").catch(() => {
      throw new Error("BLOB_MODE=vercel-blob but @vercel/blob is not installed.")
    })
    await del(key, { token: process.env.BLOB_READ_WRITE_TOKEN })
    return
  }
  if (mode === "supabase-storage") {
    const { supabase } = await import("./db-adapter")
    const bucket = process.env.SUPABASE_STORAGE_BUCKET
    if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET missing")
    await supabase().storage.from(bucket).remove([key])
    return
  }
  const abs = path.join(LOCAL_ROOT, key)
  await fs.rm(abs, { force: true })
}
