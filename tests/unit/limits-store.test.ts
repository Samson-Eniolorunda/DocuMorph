import { describe, expect, it, vi } from "vitest";
import { addressPrefix } from "@/server/http";
import {
  checkFeedbackCalls,
  checkLimit,
  defaultCounter,
  refund,
  releaseAdobe,
  reserveAdobe,
  type Counter,
} from "@/server/rate-limit";

function counting() {
  const map = new Map<string, number>();
  const count: Counter = async (key, _ttl, by = 1) => {
    map.set(key, (map.get(key) ?? 0) + by);
    return map.get(key)!;
  };
  return { map, count };
}

describe("IPv6 visitors", () => {
  it("keys an IPv6 address on its /64 prefix", () => {
    expect(addressPrefix("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe(addressPrefix("2001:0db8:0001:0002::1"));
    expect(addressPrefix("2001:db8:1:2::1")).not.toBe(addressPrefix("2001:db8:1:3::1"));
    expect(addressPrefix("2001:DB8::1")).toBe("2001:0db8:0000:0000::/64");
  });
  it("leaves IPv4 and mapped IPv4 addresses whole", () => {
    expect(addressPrefix("203.0.113.7")).toBe("203.0.113.7");
    expect(addressPrefix("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(addressPrefix("unknown")).toBe("unknown");
  });
});

describe("conversion allowance", () => {
  it("does not spend a visitor's count when the site cap refuses the request", async () => {
    const { count, map } = counting();
    const limits = { perVisitor: 5, perSite: 1, today: "2026-11-19" };
    expect((await checkLimit("a", limits, count)).ok).toBe(true);
    const refused = await checkLimit("b", limits, count);
    expect(refused).toMatchObject({ ok: false, reason: "site" });
    expect(map.get("dm:2026-11-19:v:b")).toBe(0);
    expect(map.get("dm:2026-11-19:site")).toBe(1);
  });
});

describe("feedback allowance", () => {
  it("stops after the site-wide cap, not just the per-visitor one", async () => {
    const { count } = counting();
    for (let i = 0; i < 30; i++) expect(await checkFeedbackCalls(`v${i}`, "2026-11-19", 5, 30, count)).toBe(true);
    expect(await checkFeedbackCalls("v31", "2026-11-19", 5, 30, count)).toBe(false);
  });
  it("stops one visitor at their own limit without using the site's", async () => {
    const { count, map } = counting();
    for (let i = 0; i < 5; i++) await checkFeedbackCalls("a", "2026-11-19", 5, 30, count);
    expect(await checkFeedbackCalls("a", "2026-11-19", 5, 30, count)).toBe(false);
    expect(map.get("dm:2026-11-19:f:site")).toBe(5);
  });
});

describe("Adobe allowance", () => {
  it("releases into the day and month it was reserved in, even across midnight and month end", async () => {
    const { count, map } = counting();
    const reserved = await reserveAdobe({ monthly: 10, daily: 10, now: new Date("2026-11-30T23:59:59Z") }, count);
    if (!reserved.ok) throw new Error("expected a reservation");
    vi.setSystemTime(new Date("2026-12-01T00:00:05Z"));
    await releaseAdobe(reserved, count);
    vi.useRealTimers();
    expect(map.get("dm:adobe:d:2026-11-30")).toBe(0);
    expect(map.get("dm:adobe:m:2026-11")).toBe(0);
    expect(map.has("dm:adobe:d:2026-12-01")).toBe(false);
  });
});

describe("the shared store's answers", () => {
  const withStore = (body: unknown, status = 200) => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://store.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
    return defaultCounter();
  };
  it("accepts a well-formed answer", async () => {
    expect(await withStore([{ result: 3 }, { result: 1 }])("k", 60)).toBe(3);
  });
  it("throws on an entry with an error, or a result that is not a number", async () => {
    await expect(withStore([{ result: 3 }, { error: "ERR" }])("k", 60)).rejects.toThrow();
    await expect(withStore([{ error: "ERR" }, { result: 1 }])("k", 60)).rejects.toThrow();
    await expect(withStore([{ result: "3" }, { result: 1 }])("k", 60)).rejects.toThrow();
    await expect(withStore([{ result: null }, { result: 1 }])("k", 60)).rejects.toThrow();
    await expect(withStore({ error: "x" })("k", 60)).rejects.toThrow();
  });
  it("throws when the store answers with an error status", async () => {
    await expect(withStore([], 500)("k", 60)).rejects.toThrow();
  });
});

describe("refunds", () => {
  it("gives a visitor at most 3 refunds a day, and always gives the site count back", async () => {
    const { map, count } = counting();
    const limits = { perVisitor: 10, perSite: 100, today: "2026-11-19" };
    for (let i = 0; i < 5; i++) {
      await checkLimit("v", limits, count);
      await refund("v", limits, count);
    }
    // Five attempts; the visitor kept 3 refunds and the two later failures stayed counted.
    expect(map.get("dm:2026-11-19:v:v")).toBe(2);
    expect(map.get("dm:2026-11-19:site")).toBe(0);
  });

  it("never gives attempts back", async () => {
    const { map, count } = counting();
    const limits = { perVisitor: 10, perSite: 100, perAttempt: 2, today: "2026-11-19" };
    for (let i = 0; i < 2; i++) {
      expect((await checkLimit("v", limits, count)).ok).toBe(true);
      await refund("v", limits, count);
    }
    expect((await checkLimit("v", limits, count)).ok).toBe(false);
    expect(map.get("dm:2026-11-19:attempts")).toBe(3);
  });
});
