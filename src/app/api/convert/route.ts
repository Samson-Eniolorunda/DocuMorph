// Server conversions (Word, Excel, PDF compression) through ConvertAPI.
//
// Safeguards:
// - only the conversions listed in SERVER_TOOLS, with their own options;
// - the file's first bytes must match the tool (renamed files are refused);
// - files up to 4 MB, sent straight to ConvertAPI: nothing is stored here;
// - a daily limit per visitor and an optional daily cap for the whole site;
// - visitors are counted by a hashed IP address, never the address itself.

import { NextResponse } from "next/server";
import { detectKind, extOf, SERVER_MAX_BYTES } from "@/lib/files";
import { checkLimit } from "@/server/rate-limit";
import { serverToolBySlug } from "@/config/server-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const PER_VISITOR = Number(process.env.CONVERT_DAILY_PER_VISITOR ?? 10);
const PER_SITE = Number(process.env.CONVERT_DAILY_SITE_CAP ?? 0); // 0 = no site-wide cap

const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

async function visitorKey(req: Request, today: string) {
  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${today}:${ip}`));
  return Buffer.from(digest).toString("base64url").slice(0, 22);
}

export async function POST(req: Request) {
  const secret = process.env.CONVERTAPI_SECRET;
  if (!secret) return fail(503, "Server conversions are not set up on this site.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "The upload could not be read. Please try again.");
  }

  const tool = serverToolBySlug(String(form.get("tool") ?? ""));
  if (!tool) return fail(400, "Unknown conversion.");

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(400, "Choose a file to convert.");
  if (file.size > SERVER_MAX_BYTES) return fail(413, "Files sent to the server can be up to 4 MB.");

  const ext = extOf(file.name);
  const kind = detectKind(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!tool.accept.includes(ext) || !tool.kinds.includes(kind)) {
    return fail(415, `This tool accepts ${tool.accept.map((e) => `.${e}`).join(" or ")} files only.`);
  }

  let optionValue: string | undefined;
  if (tool.option) {
    const v = String(form.get("option") ?? tool.option.default);
    if (!tool.option.values.some((o) => o.value === v)) return fail(400, "Unknown option.");
    optionValue = v;
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    const limit = await checkLimit(await visitorKey(req, today), { perVisitor: PER_VISITOR, perSite: PER_SITE, today });
    if (!limit.ok) {
      return fail(
        429,
        limit.reason === "site"
          ? "Today's server conversions are used up. The tools that run in your browser still work."
          : `You have used today's ${PER_VISITOR} server conversions. Please try again tomorrow.`,
      );
    }
  } catch (err) {
    console.error("Rate limit check failed", err);
    return fail(503, "Server conversions are paused for a moment. Please try again shortly.");
  }

  const body = new FormData();
  body.set("File", file, file.name);
  body.set("StoreFile", "true");
  if (tool.option && optionValue) body.set(tool.option.name, optionValue);

  const url = `https://v2.convertapi.com/convert/${tool.route(ext)}?Secret=${encodeURIComponent(secret)}`;
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body, signal: AbortSignal.timeout(55_000), cache: "no-store" });
  } catch {
    return fail(504, "The conversion took too long. Please try a smaller file.");
  }

  const data = (await res.json().catch(() => null)) as {
    Files?: { FileName: string; FileSize: number; FileId: string; Url: string }[];
    Message?: string;
  } | null;

  if (!res.ok || !data?.Files?.length) {
    console.error("ConvertAPI error", res.status, data?.Message);
    return fail(
      502,
      res.status === 401
        ? "Server conversions are not available right now."
        : "The file could not be converted. It may be damaged or protected.",
    );
  }

  const out = data.Files[0];
  if (!out) return fail(502, "The file could not be converted. It may be damaged or protected.");
  return NextResponse.json(
    { name: out.FileName, size: out.FileSize, url: out.Url, fileId: out.FileId },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Deletes a converted file from ConvertAPI before its 3-hour expiry. */
export async function DELETE(req: Request) {
  const fileId = new URL(req.url).searchParams.get("fileId") ?? "";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(fileId)) return fail(400, "Unknown file.");
  const secret = process.env.CONVERTAPI_SECRET;
  if (!secret) return fail(503, "Server conversions are not set up on this site.");
  const res = await fetch(`https://v2.convertapi.com/d/${fileId}?Secret=${encodeURIComponent(secret)}`, {
    method: "DELETE",
    cache: "no-store",
  }).catch(() => null);
  // 404 means it is already gone, which is the outcome we want.
  if (res && (res.ok || res.status === 404)) return NextResponse.json({ deleted: true });
  return fail(502, "The file could not be deleted now; ConvertAPI removes it within 3 hours.");
}
