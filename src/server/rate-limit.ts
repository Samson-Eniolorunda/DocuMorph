// Limits server conversions per visitor (by IP address) per day, plus a daily
// cap for the whole site and a daily cap on attempts, so nobody can spend the
// conversion allowance. The site cap is always on.
//
// Every server tool needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
// (the free tier is enough): the counts must be shared by every server
// instance, so the tools stay off without them. The in-memory counter below
// serves only the feedback form and tests.

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
    const out = (await res.json().catch(() => null)) as { result?: unknown; error?: unknown }[] | null;
    if (!Array.isArray(out) || out.length < 2) throw new Error("Rate limit store gave an unexpected answer");
    for (const entry of out) {
      if (!entry || entry.error !== undefined || typeof entry.result !== "number")
        throw new Error("Rate limit store reported an error");
    }
    return out[0]!.result as number;
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
  {
    perVisitor,
    perSite,
    perAttempt,
    today,
  }: { perVisitor: number; perSite: number; perAttempt?: number; today: string },
  count: Counter = defaultCounter(),
): Promise<LimitResult> {
  const mine = await count(`dm:${today}:v:${visitor}`, DAY);
  if (mine > perVisitor) return { ok: false, remaining: 0, reason: "visitor" };
  if (perSite > 0) {
    const all = await count(`dm:${today}:site`, DAY);
    if (all > perSite) {
      // Refused, so nothing was converted: neither count is spent.
      await count(`dm:${today}:site`, DAY, -1);
      await count(`dm:${today}:v:${visitor}`, DAY, -1);
      return { ok: false, remaining: 0, reason: "site" };
    }
  }
  // Attempts are never given back: they bound how much work the service can be asked to do, whatever the outcome.
  if (perAttempt !== undefined && (await count(`dm:${today}:attempts`, DAY)) > perAttempt) {
    await count(`dm:${today}:site`, DAY, -1);
    await count(`dm:${today}:v:${visitor}`, DAY, -1);
    return { ok: false, remaining: 0, reason: "site" };
  }
  return { ok: true, remaining: perVisitor - mine };
}

/**
 * Gives back one conversion. Used only when the service did no work (it could not be reached, or Adobe never
 * accepted the job). The visitor gets at most `maxVisitorRefunds` a day, so failures cannot be used to loop; the
 * site count is always given back, and the attempts counter never is.
 */
export async function refund(
  visitor: string,
  { perSite, today, maxVisitorRefunds = 3 }: { perSite: number; today: string; maxVisitorRefunds?: number },
  count: Counter = defaultCounter(),
) {
  if ((await count(`dm:${today}:rf:${visitor}`, DAY)) <= maxVisitorRefunds)
    await count(`dm:${today}:v:${visitor}`, DAY, -1);
  if (perSite > 0) await count(`dm:${today}:site`, DAY, -1);
}

/**
 * Spends one unit of Adobe's free allowance, or says why it cannot. The month is counted first and the day second,
 * so a busy day cannot use up the month. Only the shared store is exact; callers must not use this without it.
 */
export async function reserveAdobe(
  { monthly, daily, now = new Date() }: { monthly: number; daily: number; now?: Date },
  count: Counter = defaultCounter(),
): Promise<{ ok: true; day: string; month: string } | { ok: false; reason: "month" | "day" }> {
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const m = await count(`dm:adobe:m:${month}`, 35 * DAY);
  if (m > monthly) {
    await count(`dm:adobe:m:${month}`, 35 * DAY, -1);
    return { ok: false, reason: "month" };
  }
  const d = await count(`dm:adobe:d:${day}`, DAY);
  if (d > daily) {
    await count(`dm:adobe:d:${day}`, DAY, -1);
    await count(`dm:adobe:m:${month}`, 35 * DAY, -1);
    return { ok: false, reason: "day" };
  }
  return { ok: true, day, month };
}

/** Gives back one unit, in the day and month it was taken from (not those of the moment of release). */
export async function releaseAdobe({ day, month }: { day: string; month: string }, count: Counter = defaultCounter()) {
  await count(`dm:adobe:d:${day}`, DAY, -1);
  await count(`dm:adobe:m:${month}`, 35 * DAY, -1);
}

export const hasSharedStore = () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

/**
 * A small daily allowance for feedback messages, per visitor and for the whole site. Counted when the message is
 * accepted; a visitor who is over their own allowance does not use up the site's.
 */
export async function checkFeedbackCalls(
  visitor: string,
  today: string,
  max: number,
  siteMax: number,
  count: Counter = defaultCounter(),
) {
  if ((await count(`dm:${today}:f:${visitor}`, DAY)) > max) return false;
  return (await count(`dm:${today}:f:site`, DAY)) <= siteMax;
}
