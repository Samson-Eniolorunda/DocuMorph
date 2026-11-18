// Limits server conversions per visitor (by IP address) per day, plus an
// optional daily cap for the whole site, so nobody can spend the ConvertAPI
// allowance.
//
// With UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set (free tier is
// enough) the counts are shared by every server instance. Without them the
// counts live in the memory of each instance: still a useful brake, but not
// exact, because Vercel may run several instances.

export interface LimitResult {
  ok: boolean;
  remaining: number;
  reason?: "visitor" | "site";
}

export type Counter = (key: string, ttlSeconds: number, by?: number) => Promise<number>;

const memory = new Map<string, { n: number; expires: number }>();

export const memoryCounter: Counter = async (key, ttl, by = 1) => {
  const now = Date.now();
  const hit = memory.get(key);
  if (!hit || hit.expires <= now) {
    memory.set(key, { n: by, expires: now + ttl * 1000 });
    return by;
  }
  hit.n += by;
  return hit.n;
};

function upstashCounter(url: string, token: string): Counter {
  return async (key, ttl, by = 1) => {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCRBY", key, String(by)],
        ["EXPIRE", key, String(ttl), "NX"],
      ]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Rate limit store answered ${res.status}`);
    const out = (await res.json()) as { result: number }[];
    return Number(out[0]?.result ?? 0);
  };
}

export function defaultCounter(): Counter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? upstashCounter(url, token) : memoryCounter;
}

const DAY = 24 * 60 * 60;

export async function checkLimit(
  visitor: string,
  { perVisitor, perSite, today }: { perVisitor: number; perSite: number; today: string },
  count: Counter = defaultCounter(),
): Promise<LimitResult> {
  const mine = await count(`dm:${today}:v:${visitor}`, DAY);
  if (mine > perVisitor) return { ok: false, remaining: 0, reason: "visitor" };
  if (perSite > 0) {
    const all = await count(`dm:${today}:site`, DAY);
    if (all > perSite) return { ok: false, remaining: 0, reason: "site" };
  }
  return { ok: true, remaining: perVisitor - mine };
}

/** Gives back one conversion, for a visitor whose conversion failed. */
export async function refund(
  visitor: string,
  { perSite, today }: { perSite: number; today: string },
  count: Counter = defaultCounter(),
) {
  await count(`dm:${today}:v:${visitor}`, DAY, -1);
  if (perSite > 0) await count(`dm:${today}:site`, DAY, -1);
}

/** A separate, generous allowance for downloading and deleting results, so those calls cannot be used without limit. */
export async function checkResultCalls(visitor: string, today: string, max = 60, count: Counter = defaultCounter()) {
  return (await count(`dm:${today}:r:${visitor}`, DAY)) <= max;
}
