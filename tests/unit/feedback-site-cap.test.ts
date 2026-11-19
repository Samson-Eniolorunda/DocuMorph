import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/feedback/route";

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("FEEDBACK_TO_EMAIL", "owner@example.com");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const send = (address: string) =>
  POST(
    new Request("http://localhost/api/feedback", {
      method: "POST",
      body: JSON.stringify({ message: "A friendly message" }),
      headers: { "x-forwarded-for": address },
    }),
  );

it("stops at 30 messages a day for the whole site, and counts an IPv6 /64 as one visitor", async () => {
  for (let i = 0; i < 30; i++) expect((await send(`198.51.100.${i}`)).status).toBe(200);
  expect((await send("198.51.100.200")).status).toBe(429);
});

it("limits one IPv6 /64 as a single visitor", async () => {
  vi.resetModules();
  const { POST: fresh } = await import("@/app/api/feedback/route");
  const post = (a: string) =>
    fresh(
      new Request("http://x/api/feedback", {
        method: "POST",
        body: JSON.stringify({ message: "Another note" }),
        headers: { "x-forwarded-for": a },
      }),
    );
  for (let i = 0; i < 5; i++) expect((await post(`2001:db8:9:9:${i}::1`)).status).toBe(200);
  expect((await post("2001:db8:9:9:ffff::1")).status).toBe(429);
});
