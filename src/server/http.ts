import { NextResponse } from "next/server";

export const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/** The first address in x-forwarded-for, which Vercel sets; "unknown" when there is none. */
export const clientAddress = (req: Request) =>
  (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";

async function sha(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Buffer.from(digest).toString("base64url");
}

/** A hashed visitor key that changes every day; the address itself is never stored. */
export const visitorKey = async (req: Request, today: string) =>
  (await sha(`${today}:${clientAddress(req)}`)).slice(0, 22);

/** Proves a result belongs to the visitor who converted it, without a database. */
export async function resultToken(secret: string, id: string, req: Request) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}:${clientAddress(req)}`));
  return Buffer.from(mac).toString("base64url").slice(0, 32);
}
