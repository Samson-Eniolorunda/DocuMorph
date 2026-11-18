// Sends one feedback message to the owner through Resend. Nothing is stored here.
// Resend's free plan, without a verified domain, sends from its own test address and only to the
// account owner's own address, which is exactly this use.

import type { Feedback } from "@/schemas/feedback";

export type MailOutcome = { ok: true } | { ok: false; reason: "failed" | "timeout" };

const clean = (text: string) => text.replace(/[\r\n]+/g, " ").slice(0, 120);

export async function sendFeedback(
  { apiKey, to }: { apiKey: string; to: string },
  feedback: Feedback,
  fetcher: typeof fetch = fetch,
): Promise<MailOutcome> {
  const lines = [
    feedback.message,
    "",
    "---",
    `Page: ${feedback.page ?? "not given"}`,
    `Reply to: ${feedback.email ?? "not given"}`,
  ];
  try {
    const res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "DocuMorph feedback <onboarding@resend.dev>",
        to: [to],
        ...(feedback.email ? { reply_to: feedback.email } : {}),
        subject: clean(`DocuMorph feedback: ${feedback.message}`),
        text: lines.join("\n"),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    return res.ok ? { ok: true } : { ok: false, reason: "failed" };
  } catch (err) {
    return { ok: false, reason: err instanceof DOMException && err.name === "TimeoutError" ? "timeout" : "failed" };
  }
}
