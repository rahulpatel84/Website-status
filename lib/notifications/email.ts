// Email transport. Uses Resend when RESEND_API_KEY is set; otherwise mocks.

import { logEvent } from "@/lib/logs"

// Recipient addresses are PII — the event log only ever sees the domain part.
function recipientDomains(recipients: string[]): string[] {
  return Array.from(
    new Set(recipients.map((addr) => addr.split("@")[1] ?? "unknown")),
  )
}

export interface SendEmailArgs {
  to: string | string[]
  subject: string
  html?: string
  text?: string
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  mocked?: boolean
  error?: string
}

const FROM_ADDRESS =
  process.env.EMAIL_FROM || "status.watch <alerts@status.watch>"

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailArgs): Promise<SendEmailResult> {
  const recipients = Array.isArray(to) ? to : [to]
  if (recipients.length === 0 || recipients.some((addr) => !addr)) {
    return { ok: false, error: "recipient missing" }
  }
  if (!subject) {
    return { ok: false, error: "subject missing" }
  }
  if (!html && !text) {
    return { ok: false, error: "html or text body required" }
  }

  if (!process.env.RESEND_API_KEY) {
    console.log("[email:mock]", {
      to: recipients,
      subject,
      html,
      text,
    })
    logEvent({
      level: "info",
      source: "notification",
      event: "notification.email_sent",
      message: `Email "${subject}" mocked (RESEND_API_KEY unset)`,
      targetType: "email",
      metadata: {
        subject,
        mocked: true,
        recipientCount: recipients.length,
        recipientDomains: recipientDomains(recipients),
      },
    })
    return { ok: true, mocked: true }
  }

  try {
    const { Resend } = await import("resend")
    const client = new Resend(process.env.RESEND_API_KEY)
    const result = await client.emails.send({
      from: FROM_ADDRESS,
      to: recipients,
      subject,
      html: html ?? undefined,
      text: text ?? undefined,
    })

    // Resend returns { data: { id }, error: null } on success.
    const anyResult = result as unknown as {
      data?: { id?: string } | null
      error?: { message?: string } | null
      id?: string
    }
    if (anyResult.error) {
      const error = anyResult.error.message || "resend error"
      logEvent({
        level: "error",
        source: "notification",
        event: "notification.email_failed",
        message: `Email "${subject}" rejected by Resend: ${error}`,
        targetType: "email",
        metadata: {
          subject,
          error,
          recipientCount: recipients.length,
          recipientDomains: recipientDomains(recipients),
        },
      })
      return { ok: false, error }
    }
    const id = anyResult.data?.id ?? anyResult.id
    logEvent({
      level: "info",
      source: "notification",
      event: "notification.email_sent",
      message: `Email "${subject}" sent`,
      targetType: "email",
      targetId: id,
      metadata: {
        subject,
        recipientCount: recipients.length,
        recipientDomains: recipientDomains(recipients),
      },
    })
    return { ok: true, id }
  } catch (err) {
    const message = err instanceof Error ? err.message : "email send failed"
    logEvent({
      level: "error",
      source: "notification",
      event: "notification.email_failed",
      message: `Email "${subject}" failed: ${message}`,
      targetType: "email",
      metadata: {
        subject,
        error: message,
        recipientCount: recipients.length,
        recipientDomains: recipientDomains(recipients),
      },
    })
    return { ok: false, error: message }
  }
}
