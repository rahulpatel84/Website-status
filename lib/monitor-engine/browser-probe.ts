// Real-browser probe using Playwright + Chromium.
// Loads a page, verifies selectors, optionally fills + submits a form,
// captures a screenshot, and reports console errors.

import { chromium, type Browser } from "playwright"
import { performance } from "node:perf_hooks"
import { mkdir, writeFile, stat } from "node:fs/promises"
import path from "node:path"
import { getDatabase } from "@/lib/database"

const SCREENSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

let sharedBrowser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.isConnected()) return sharedBrowser
  sharedBrowser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  })
  return sharedBrowser
}

export interface FormProbeConfig {
  /** page to load */
  url: string
  /** must appear before probe declares success */
  wait_for_selector?: string
  /** map of CSS selector -> value to type */
  fill?: Record<string, string>
  /** click this after fill */
  submit_selector?: string
  /** after submit, this selector must appear */
  expect_selector_after?: string
  /** after submit, page URL must match this JS regex string */
  expect_url_regex_after?: string
  /** max ms allowed for the whole run (default 25s) */
  timeout_ms?: number
}

export interface BrowserProbeResult {
  ok: boolean
  layer_failed: string | null
  step_failed: string | null
  ms: number
  http_status: number | null
  screenshot_path: string | null
  console_errors: string[]
  final_url: string | null
  detail: string
}

/**
 * Runs the form-check flow. Returns a rich result including screenshot path
 * (relative to /public) so the UI can render it.
 */
export async function probeForm(
  monitorId: string,
  cfg: FormProbeConfig,
): Promise<BrowserProbeResult> {
  const started = performance.now()
  const timeout = cfg.timeout_ms ?? 25000
  const consoleErrors: string[] = []
  let httpStatus: number | null = null

  let browser: Browser
  try {
    browser = await getBrowser()
  } catch (e: any) {
    return {
      ok: false,
      layer_failed: "runtime",
      step_failed: "browser_launch",
      ms: Math.round(performance.now() - started),
      http_status: null,
      screenshot_path: null,
      console_errors: [],
      final_url: null,
      detail: "Failed to launch Chromium: " + (e?.message ?? "unknown"),
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) statuswatch/1.0 Chrome/126.0.0.0 Safari/537.36",
    ignoreHTTPSErrors: false,
  })

  const page = await context.newPage()
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 500))
  })
  page.on("pageerror", (err) => consoleErrors.push(err.message.slice(0, 500)))
  page.on("response", (res) => {
    if (res.url() === cfg.url || res.url().startsWith(cfg.url)) {
      if (httpStatus === null) httpStatus = res.status()
    }
  })

  const finish = async (result: Omit<BrowserProbeResult, "ms" | "console_errors" | "http_status">) => {
    try {
      await context.close()
    } catch {}
    return {
      ...result,
      ms: Math.round(performance.now() - started),
      console_errors: consoleErrors.slice(0, 8),
      http_status: httpStatus,
    }
  }

  // ---- Step 1: navigate ----
  // We use `load` first (faster fail-fast on 4xx/5xx) then wait for network to
  // settle so lazy-loaded iframes (HubSpot, Marketo, reCAPTCHA) are captured.
  try {
    const resp = await page.goto(cfg.url, { waitUntil: "load", timeout })
    if (resp) httpStatus = resp.status()
    if (!resp || !resp.ok()) {
      const screenshot = await captureShot(page, monitorId).catch(() => null)
      return finish({
        ok: false,
        layer_failed: "http_head",
        step_failed: "navigate",
        screenshot_path: screenshot,
        final_url: page.url(),
        detail: `Navigation failed — status ${resp?.status() ?? "?"}`,
      })
    }
    // Give third-party embeds (HubSpot / Marketo / reCAPTCHA) up to 8s to arrive.
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {})
    // Small nudge for CSS animations / hero fades.
    await page.waitForTimeout(500)
  } catch (e: any) {
    const screenshot = await captureShot(page, monitorId).catch(() => null)
    return finish({
      ok: false,
      layer_failed: "http_head",
      step_failed: "navigate",
      screenshot_path: screenshot,
      final_url: page.url(),
      detail: e?.message ?? "goto failed",
    })
  }

  // ---- Step 2: wait for required selector ----
  if (cfg.wait_for_selector) {
    try {
      await page.waitForSelector(cfg.wait_for_selector, { timeout: 10000, state: "visible" })
    } catch {
      const screenshot = await captureShot(page, monitorId).catch(() => null)
      return finish({
        ok: false,
        layer_failed: "body_assertion",
        step_failed: "wait_for_selector",
        screenshot_path: screenshot,
        final_url: page.url(),
        detail: `Required selector never appeared: ${cfg.wait_for_selector}`,
      })
    }
  }

  // ---- Step 3: fill fields ----
  if (cfg.fill) {
    for (const [selector, value] of Object.entries(cfg.fill)) {
      try {
        await page.locator(selector).first().fill(value, { timeout: 5000 })
      } catch (e: any) {
        const screenshot = await captureShot(page, monitorId).catch(() => null)
        return finish({
          ok: false,
          layer_failed: "body_assertion",
          step_failed: `fill:${selector}`,
          screenshot_path: screenshot,
          final_url: page.url(),
          detail: `Could not fill ${selector}: ${e?.message ?? "unknown"}`,
        })
      }
    }
  }

  // ---- Step 4: submit ----
  if (cfg.submit_selector) {
    try {
      const nav = page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => null)
      await page.locator(cfg.submit_selector).first().click({ timeout: 5000 })
      await nav
    } catch (e: any) {
      const screenshot = await captureShot(page, monitorId).catch(() => null)
      return finish({
        ok: false,
        layer_failed: "body_assertion",
        step_failed: "submit",
        screenshot_path: screenshot,
        final_url: page.url(),
        detail: `Submit failed: ${e?.message ?? "unknown"}`,
      })
    }
  }

  // ---- Step 5: post-submit assertions ----
  if (cfg.expect_selector_after) {
    try {
      await page.waitForSelector(cfg.expect_selector_after, { timeout: 10000, state: "visible" })
    } catch {
      const screenshot = await captureShot(page, monitorId).catch(() => null)
      return finish({
        ok: false,
        layer_failed: "body_assertion",
        step_failed: "expect_selector_after",
        screenshot_path: screenshot,
        final_url: page.url(),
        detail: `Post-submit selector missing: ${cfg.expect_selector_after}`,
      })
    }
  }

  if (cfg.expect_url_regex_after) {
    try {
      const rx = new RegExp(cfg.expect_url_regex_after)
      if (!rx.test(page.url())) {
        const screenshot = await captureShot(page, monitorId).catch(() => null)
        return finish({
          ok: false,
          layer_failed: "body_assertion",
          step_failed: "expect_url_regex_after",
          screenshot_path: screenshot,
          final_url: page.url(),
          detail: `Final URL ${page.url()} did not match ${cfg.expect_url_regex_after}`,
        })
      }
    } catch (e: any) {
      // invalid regex
    }
  }

  // Success — snap a screenshot as evidence
  const screenshot = await captureShot(page, monitorId).catch(() => null)
  return finish({
    ok: true,
    layer_failed: null,
    step_failed: null,
    screenshot_path: screenshot,
    final_url: page.url(),
    detail: "All assertions passed",
  })
}

async function captureShot(page: any, monitorId: string): Promise<string> {
  const dir = path.join(process.cwd(), "public", "probe-shots")
  await mkdir(dir, { recursive: true })
  const filename = `${monitorId}-${Date.now()}.png`
  const abs = path.join(dir, filename)
  const buf: Buffer = await page.screenshot({ fullPage: true, type: "png" })
  await writeFile(abs, buf)
  const relPath = `/probe-shots/${filename}`

  // Track in DB so cleanup + zip-download can find it.
  try {
    const db = getDatabase()
    const row = db
      .prepare("SELECT workspace_id FROM monitors WHERE id = ?")
      .get(monitorId) as { workspace_id: string } | undefined
    if (row) {
      const expires = new Date(Date.now() + SCREENSHOT_TTL_MS).toISOString()
      db.prepare(
        "INSERT INTO probe_screenshots (monitor_id, workspace_id, path, size_bytes, expires_at) VALUES (?, ?, ?, ?, ?)",
      ).run(monitorId, row.workspace_id, relPath, buf.byteLength, expires)
    }
  } catch {
    /* recording failure must not break the probe */
  }

  return relPath
}
