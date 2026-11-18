// Server conversions (Word, Excel, PDF compression) through ConvertAPI.
//
// Safeguards:
// - only the conversions listed in SERVER_TOOLS, with their own options (zod schema);
// - the file's first bytes and its extension must match the tool, so renamed files are refused;
// - files up to 4 MB, sent straight to ConvertAPI: nothing is stored here;
// - a daily limit per visitor and an optional site-wide cap, spent only when a conversion succeeds;
// - visitors are counted by a hashed address, never the address itself.

import { NextResponse } from "next/server";
import { serverToolBySlug } from "@/config/server-tools";
import { detectKind, extOf, SERVER_MAX_BYTES } from "@/lib/files";
import { convertFields } from "@/schemas/convert";
import { convertFile } from "@/server/convertapi";
import { loadEnv } from "@/server/env";
import { fail, resultToken, visitorKey } from "@/server/http";
import { checkLimit, refund } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const config = loadEnv();
  if (!config.ok) {
    console.error("Invalid server settings", config.problems);
    return fail(503, "Server conversions are not set up on this site.");
  }
  const { env } = config;
  if (!env.CONVERTAPI_SECRET) return fail(503, "Server conversions are not set up on this site.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "The upload could not be read. Please try again.");
  }

  const fields = convertFields.safeParse({ tool: form.get("tool"), option: form.get("option") ?? undefined });
  if (!fields.success) return fail(400, "Unknown conversion.");
  const tool = serverToolBySlug(fields.data.tool);
  if (!tool) return fail(400, "Unknown conversion.");

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(400, "Choose a file to convert.");
  if (file.size > SERVER_MAX_BYTES) return fail(413, "Files sent to the server can be up to 4 MB.");

  const ext = extOf(file.name);
  const kind = detectKind(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!tool.accept.includes(ext) || !tool.kinds.includes(kind)) {
    return fail(415, `This tool accepts ${tool.accept.map((e) => `.${e}`).join(" or ")} files only.`);
  }

  let option: { name: string; value: string } | undefined;
  if (tool.option) {
    const value = fields.data.option ?? tool.option.default;
    if (!tool.option.values.some((o) => o.value === value)) return fail(400, "Unknown option.");
    option = { name: tool.option.name, value };
  }

  const today = new Date().toISOString().slice(0, 10);
  const visitor = await visitorKey(req, today);
  const limits = { perVisitor: env.CONVERT_DAILY_PER_VISITOR, perSite: env.CONVERT_DAILY_SITE_CAP, today };
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

  const outcome = await convertFile(env.CONVERTAPI_SECRET, tool.route(ext), file, option);
  if (!outcome.ok) {
    await refund(visitor, limits).catch(() => undefined);
    if (outcome.reason === "timeout") return fail(504, "The conversion took too long. Please try a smaller file.");
    return fail(
      502,
      outcome.reason === "unauthorised"
        ? "Server conversions are not available right now."
        : "The file could not be converted. It may be damaged or protected.",
    );
  }

  const token = await resultToken(env.CONVERTAPI_SECRET, outcome.file.fileId, req);
  return NextResponse.json({ ...outcome.file, token, remaining }, { headers: { "Cache-Control": "no-store" } });
}
