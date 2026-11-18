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

type Counter = (key: string, ttlSeconds: number) => Promise<number>;

const memory = new Map<string, { n: number; expires: number }>();

export const memoryCounter: Counter = async (key, ttl) => {
  const now = Date.now();
  const hit = memory.get(key);
  if (!hit || hit.expires <= now) {
    memory.set(key, { n: 1, expires: now + ttl * 1000 });
    return 1;
  }
  hit.n += 1;
  return hit.n;
};

function upstashCounter(url: string, token: string): Counter {
  return async (key, ttl) => {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
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
