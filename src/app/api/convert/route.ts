// Server conversions: Word and Excel to PDF (Gotenberg) and PDF to Word or Excel (Adobe PDF Services).
//
// Safeguards:
// - only the conversions listed in SERVER_TOOLS (zod schema);
// - the file's first bytes and its extension must match the tool, so renamed files are refused;
// - files up to 4 MB, because Vercel accepts request bodies up to 4.5 MB;
// - a daily limit per visitor, a site-wide cap and a cap on attempts. Once a service has been contacted the attempt
//   stays counted, so failing or oversized files cannot be looped for free; only a service that could not be
//   reached gives the count back (at most 3 a day to a visitor);
// - results over 4.5 MB (Vercel's response limit) are refused before sending;
// - for Adobe, a monthly and a daily cap on the whole site so the free allowance is never exceeded;
// - nothing is written anywhere: the converted file is sent back in the same response;
// - visitors are counted by a hashed address, never the address itself.

import { serverToolBySlug } from "@/config/server-tools";
import { detectKind, extOf, SERVER_MAX_BYTES, SERVER_RESULT_MAX_BYTES } from "@/lib/files";
import { convertFields } from "@/schemas/convert";
import { exportPdf, adobeMediaType, type AdobeTarget } from "@/server/adobe";
import { adobeConfig, gotenbergConfig, loadEnv } from "@/server/env";
import { officeToPdf } from "@/server/gotenberg";
import { afterResponse, fail, visitorKey } from "@/server/http";
import { checkLimit, hasSharedStore, refund, releaseAdobe, reserveAdobe } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const PDF_TYPE = "application/pdf";
const busy = (name: string) =>
  `${name} is busy today, please try tomorrow. The tools that run in your browser still work.`;

export async function POST(req: Request) {
  const config = loadEnv();
  if (!config.ok) {
    console.error("Invalid server settings", config.problems);
    return fail(503, "Server conversions are not set up on this site.");
  }
  const { env } = config;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "The upload could not be read. Please try again.");
  }

  const fields = convertFields.safeParse({ tool: form.get("tool") });
  if (!fields.success) return fail(400, "Unknown conversion.");
  const tool = serverToolBySlug(fields.data.tool);
  if (!tool) return fail(400, "Unknown conversion.");

  const gotenberg = gotenbergConfig(env);
  const adobe = adobeConfig(env);
  // Every server tool costs money or a free allowance, so none runs without the store that shares the counts.
  if (!(tool.engine === "gotenberg" ? gotenberg : adobe) || !hasSharedStore())
    return fail(503, "This conversion is not set up on this site.");

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(400, "Choose a file to convert.");
  if (file.size > SERVER_MAX_BYTES)
    return fail(413, "Files sent to the server can be up to 4 MB. This file is too large for this tool.");

  const ext = extOf(file.name);
  const kind = detectKind(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!tool.accept.includes(ext) || !tool.kinds.includes(kind)) {
    return fail(415, `This tool accepts ${tool.accept.map((e) => `.${e}`).join(" or ")} files only.`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const visitor = await visitorKey(req, today);
  const limits = {
    perVisitor: env.CONVERT_DAILY_PER_VISITOR,
    perSite: env.CONVERT_DAILY_SITE_CAP,
    perAttempt: env.CONVERT_DAILY_ATTEMPT_CAP,
    today,
  };
  let remaining: number;
  try {
    const limit = await checkLimit(visitor, limits);
    if (!limit.ok) {
      return fail(
        429,
        limit.reason === "site"
          ? "Today's server conversions are used up. The tools that run in your browser still work."
          : `You have used today's ${env.CONVERT_DAILY_PER_VISITOR} server conversions. Please try again tomorrow.`,
      );
    }
    remaining = limit.remaining;
  } catch (err) {
    console.error("Rate limit check failed", err);
    return fail(503, "Server conversions are paused for a moment. Please try again shortly.");
  }

  let bytes: Uint8Array;
  let failure: "timeout" | "unauthorised" | "quota" | "unavailable" | "failed" | null = null;
  // Set once Adobe's allowance is spent; cleared when its job is accepted, because from then on it may have been used.
  let reservation: { day: string; month: string } | null = null;
  // Set once the service has been contacted (Gotenberg) or has accepted the job (Adobe): from then on it may have
  // done work, so the attempt stays counted against the visitor and the site.
  let spent = false;
  const giveBack = async () => {
    if (!spent) await refund(visitor, limits).catch(() => undefined);
    if (reservation) await releaseAdobe(reservation).catch(() => undefined);
  };

  if (tool.engine === "gotenberg" && gotenberg) {
    const out = await officeToPdf(gotenberg, file);
    // Only a service that could not be reached, or refused the credentials, did no work.
    spent = out.ok || (out.reason !== "unavailable" && out.reason !== "unauthorised");
    if (out.ok) bytes = out.bytes;
    else {
      failure = out.reason;
      bytes = new Uint8Array();
    }
  } else if (adobe) {
    try {
      const reserved = await reserveAdobe({ monthly: env.ADOBE_MONTHLY_CAP, daily: env.ADOBE_DAILY_CAP });
      if (!reserved.ok) {
        await refund(visitor, limits).catch(() => undefined);
        return fail(503, busy(tool.name));
      }
      reservation = { day: reserved.day, month: reserved.month };
    } catch (err) {
      console.error("Adobe cap check failed", err);
      await refund(visitor, limits).catch(() => undefined);
      return fail(503, "Server conversions are paused for a moment. Please try again shortly.");
    }
    const out = await exportPdf(adobe, file, tool.outExt as AdobeTarget);
    await afterResponse(out.cleanup);
    if (out.accepted) {
      reservation = null;
      spent = true;
    }
    if (out.ok) bytes = out.bytes;
    else {
      failure = out.reason;
      bytes = new Uint8Array();
    }
  } else {
    return fail(503, "This conversion is not set up on this site.");
  }

  if (failure) {
    await giveBack();
    console.error("Conversion failed", tool.slug, failure);
    if (failure === "timeout") return fail(504, "The conversion took too long. Please try a smaller file.");
    if (failure === "quota") return fail(503, busy(tool.name));
    if (failure === "unauthorised" || failure === "unavailable")
      return fail(502, "Server conversions are not available right now. Please try again later.");
    return fail(502, "The file could not be converted. It may be damaged or protected.");
  }

  if (bytes.byteLength > SERVER_RESULT_MAX_BYTES) {
    // The work was done, so nothing is given back.
    return fail(
      413,
      "The converted file is larger than the 4.5 MB this site can send back. Please try a smaller or simpler file.",
    );
  }

  const type = tool.outExt === "pdf" ? PDF_TYPE : adobeMediaType(tool.outExt as AdobeTarget);
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
      "X-Remaining": String(remaining),
    },
  });
}
