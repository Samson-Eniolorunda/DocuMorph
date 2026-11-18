// Feedback from the form: validated, limited per visitor, and e-mailed to the owner only. Nothing is stored.

import { feedbackSchema } from "@/schemas/feedback";
import { loadEnv } from "@/server/env";
import { fail, visitorKey } from "@/server/http";
import { checkFeedbackCalls } from "@/server/rate-limit";
import { sendFeedback } from "@/server/mail";

export const runtime = "nodejs";
export const maxDuration = 15;

const MAX_BODY_BYTES = 16 * 1024;
export const FEEDBACK_PER_DAY = 5;

export async function POST(req: Request) {
  const config = loadEnv();
  if (!config.ok || !config.env.RESEND_API_KEY || !config.env.FEEDBACK_TO_EMAIL)
    return fail(503, "Feedback is not set up on this site yet.");

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return fail(413, "That message is too long.");

  let json: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return fail(413, "That message is too long.");
    json = JSON.parse(text);
  } catch {
    return fail(400, "The message could not be read.");
  }

  const parsed = feedbackSchema.safeParse(json);
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Please check the form.");
  // A filled hidden field means software; answer as if it worked so it learns nothing.
  if (parsed.data.website) return Response.json({ sent: true });

  const today = new Date().toISOString().slice(0, 10);
  const allowed = await checkFeedbackCalls(await visitorKey(req, today), today, FEEDBACK_PER_DAY).catch(() => false);
  if (!allowed) return fail(429, "You have sent several messages today. Please try again tomorrow.");

  const sent = await sendFeedback({ apiKey: config.env.RESEND_API_KEY, to: config.env.FEEDBACK_TO_EMAIL }, parsed.data);
  if (!sent.ok) {
    console.error("Feedback could not be sent", sent.reason);
    return fail(502, "Your message could not be sent. Please try again in a moment.");
  }
  return Response.json({ sent: true }, { headers: { "Cache-Control": "no-store" } });
}
