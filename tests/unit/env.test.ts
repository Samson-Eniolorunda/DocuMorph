import { describe, expect, it } from "vitest";
import { loadEnv } from "@/server/env";

describe("server settings", () => {
  it("uses defaults when nothing is set", () => {
    const r = loadEnv({});
    expect(r.ok && r.env.CONVERT_DAILY_PER_VISITOR).toBe(10);
    expect(r.ok && r.env.CONVERT_DAILY_SITE_CAP).toBe(200);
    expect(r.ok && r.env.ADOBE_MONTHLY_CAP).toBe(450);
    expect(r.ok && r.env.ADOBE_DAILY_CAP).toBe(25);
  });

  it("reads valid numbers", () => {
    const r = loadEnv({ CONVERT_DAILY_PER_VISITOR: "5", CONVERT_DAILY_SITE_CAP: "400" });
    expect(r.ok && [r.env.CONVERT_DAILY_PER_VISITOR, r.env.CONVERT_DAILY_SITE_CAP]).toEqual([5, 400]);
  });

  it("refuses a mistyped limit instead of silently turning the limit off", () => {
    for (const bad of ["ten", "5.5", "-1", "0", "1e9"]) {
      const r = loadEnv({ CONVERT_DAILY_PER_VISITOR: bad });
      expect(r.ok, bad).toBe(false);
    }
    expect(loadEnv({ CONVERT_DAILY_SITE_CAP: "lots" }).ok).toBe(false);
  });

  it("refuses 0 for the site and attempt caps, so they cannot be switched off", () => {
    expect(loadEnv({ CONVERT_DAILY_SITE_CAP: "0" }).ok).toBe(false);
    expect(loadEnv({ CONVERT_DAILY_ATTEMPT_CAP: "0" }).ok).toBe(false);
    const r = loadEnv({});
    expect(r.ok && r.env.CONVERT_DAILY_ATTEMPT_CAP).toBe(300);
  });

  it("refuses a malformed store address", () => {
    expect(loadEnv({ UPSTASH_REDIS_REST_URL: "not a url", UPSTASH_REDIS_REST_TOKEN: "t" }).ok).toBe(false);
  });

  it("requires the converter address to be https", () => {
    expect(loadEnv({ GOTENBERG_URL: "http://office.example" }).ok).toBe(false);
    expect(loadEnv({ GOTENBERG_URL: "ftp://office.example" }).ok).toBe(false);
    expect(loadEnv({ GOTENBERG_URL: "https://office.example" }).ok).toBe(true);
  });

  it("refuses a malformed feedback address and a malformed converter address", () => {
    expect(loadEnv({ FEEDBACK_TO_EMAIL: "not an email" }).ok).toBe(false);
    expect(loadEnv({ GOTENBERG_URL: "office" }).ok).toBe(false);
    expect(loadEnv({ FEEDBACK_TO_EMAIL: "me@example.com", GOTENBERG_URL: "https://office.example" }).ok).toBe(true);
  });
});
