import { after, NextResponse } from "next/server";

export const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/** The first address in x-forwarded-for, which Vercel sets; "unknown" when there is none. */
export const clientAddress = (req: Request) =>
  (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";

/**
 * The part of an address that identifies one visitor: an IPv4 address whole, an IPv6 address by its /64 prefix
 * (a home network is given a whole /64, so one visitor could otherwise rotate through billions of addresses).
 */
export function addressPrefix(address: string): string {
  const bare = address
    .split("%")[0]!
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  if (!bare.includes(":")) return bare;
  const mapped = /^(?:0*:)*:ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(bare) ?? /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(bare);
  if (mapped) return mapped[1]!;
  const [head = "", tail] = bare.split("::");
  const front = head ? head.split(":") : [];
  const back = tail ? tail.split(":") : [];
  const groups =
    tail === undefined
      ? front
      : [...front, ...new Array(Math.max(0, 8 - front.length - back.length)).fill("0"), ...back];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return bare;
  return `${groups
    .slice(0, 4)
    .map((g) => g.padStart(4, "0"))
    .join(":")}::/64`;
}

/** Runs a task once the response has been sent; outside a request (in tests) it simply runs it now. */
export async function afterResponse(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    await task().catch(() => undefined);
  }
}

async function sha(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Buffer.from(digest).toString("base64url");
}

/** A hashed visitor key that changes every day; the address itself is never stored. */
export const visitorKey = async (req: Request, today: string) =>
  (await sha(`${today}:${addressPrefix(clientAddress(req))}`)).slice(0, 22);

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
