// Hands a converted file to the visitor who made it, from this site's own address so the name is kept,
// and deletes it from ConvertAPI as soon as it has been sent. DELETE discards it without downloading.

import { resultQuery } from "@/schemas/convert";
import { deleteResult, fetchResult } from "@/server/convertapi";
import { loadEnv } from "@/server/env";
import { fail, resultToken, visitorKey } from "@/server/http";
import { checkResultCalls } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

async function authorise(req: Request) {
  const config = loadEnv();
  if (!config.ok || !config.env.CONVERTAPI_SECRET)
    return { error: fail(503, "Server conversions are not set up on this site.") };
  const secret = config.env.CONVERTAPI_SECRET;
  const url = new URL(req.url);
  const query = resultQuery.safeParse({ fileId: url.searchParams.get("fileId"), token: url.searchParams.get("token") });
  if (!query.success) return { error: fail(400, "Unknown file.") };
  const today = new Date().toISOString().slice(0, 10);
  const allowed = await checkResultCalls(await visitorKey(req, today), today).catch(() => false);
  if (!allowed) return { error: fail(429, "Too many requests. Please try again later.") };
  // Constant-shape check: the token must be the one issued to this visitor for this file.
  if ((await resultToken(secret, query.data.fileId, req)) !== query.data.token)
    return { error: fail(403, "This file does not belong to you.") };
  return { secret, fileId: query.data.fileId };
}

export async function GET(req: Request) {
  const auth = await authorise(req);
  if (auth.error) return auth.error;
  const res = await fetchResult(auth.secret, auth.fileId).catch(() => null);
  if (!res || !res.ok || !res.body) return fail(404, "The file is no longer available. Please convert it again.");
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
  });
  const length = res.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  const bytes = await res.arrayBuffer();
  await deleteResult(auth.secret, auth.fileId);
  return new Response(bytes, { headers });
}

export async function DELETE(req: Request) {
  const auth = await authorise(req);
  if (auth.error) return auth.error;
  if (await deleteResult(auth.secret, auth.fileId))
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  return fail(502, "The file could not be deleted now; ConvertAPI removes it within 3 hours.");
}
