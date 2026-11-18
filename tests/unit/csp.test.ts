import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, newNonce } from "@/lib/csp";

describe("content security policy", () => {
  it("gives every request its own nonce", () => {
    expect(newNonce()).not.toBe(newNonce());
    expect(newNonce()).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
  });
  it("allows scripts only with the nonce, never inline or from elsewhere", () => {
    const csp = contentSecurityPolicy("abc123");
    const script = csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    expect(script).toContain("'nonce-abc123'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(script).not.toMatch(/https?:/);
  });
  it("blocks framing, plugins and other sites", () => {
    const csp = contentSecurityPolicy("n");
    for (const d of [
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "connect-src 'self'",
      "default-src 'self'",
    ])
      expect(csp).toContain(d);
    expect(csp).not.toMatch(/https?:\/\//);
  });
  it("allows eval only while developing", () => {
    expect(contentSecurityPolicy("n", true)).toContain("'unsafe-eval'");
  });
});
