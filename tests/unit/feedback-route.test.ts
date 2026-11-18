import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/feedback/route";

let n = 0;
const send = (body: unknown, address = `198.51.100.${++n}`) =>
  POST(
    new Request("http://localhost/api/feedback", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "x-forwarded-for": address, "content-type": "application/json" },
    }),
  );

let resend: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("FEEDBACK_TO_EMAIL", "owner@example.com");
  resend = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", resend);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/feedback", () => {
  it("answers 503 when it is not set up", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await send({ message: "Hello there" })).status).toBe(503);
    expect(resend).not.toHaveBeenCalled();
  });

  it("e-mails the owner only, with the page and a reply address", async () => {
    const res = await send({ message: "The merge page is great", email: "me@example.org", page: "/merge-pdf" });
    expect(res.status).toBe(200);
    const [url, init] = resend.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    const mail = JSON.parse(String(init.body)) as { to: string[]; reply_to: string; text: string; subject: string };
    expect(mail.to).toEqual(["owner@example.com"]);
    expect(mail.reply_to).toBe("me@example.org");
    expect(mail.text).toContain("Page: /merge-pdf");
  });

  it("works without an e-mail address", async () => {
    expect((await send({ message: "Anonymous note", email: "" })).status).toBe(200);
    const mail = JSON.parse(String((resend.mock.calls[0] as [string, RequestInit])[1].body)) as Record<string, unknown>;
    expect(mail).not.toHaveProperty("reply_to");
  });

  it("refuses an empty, short or over-long message, and a bad address (400)", async () => {
    expect((await send({ message: "" })).status).toBe(400);
    expect((await send({ message: "hi" })).status).toBe(400);
    expect((await send({ message: "x".repeat(2001) })).status).toBe(400);
    expect((await send({ message: "Hello there", email: "nope" })).status).toBe(400);
    expect((await send("not json")).status).toBe(400);
    expect(resend).not.toHaveBeenCalled();
  });

  it("ignores a page that is not a path on this site, and cannot be used to inject mail headers", async () => {
    await send({ message: "Line one\r\nBcc: someone@evil.example", page: "https://evil.example/x" });
    const mail = JSON.parse(String((resend.mock.calls[0] as [string, RequestInit])[1].body)) as {
      subject: string;
      text: string;
    };
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.text).toContain("Page: not given");
  });

  it("quietly drops a message that fills the hidden field", async () => {
    const res = await send({ message: "Buy pills now", website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(resend).not.toHaveBeenCalled();
  });

  it("refuses a very large body (413)", async () => {
    expect((await send({ message: "x".repeat(20_000) })).status).toBe(413);
  });

  it("limits each visitor to five a day (429)", async () => {
    const address = `198.51.100.${++n}`;
    for (let i = 0; i < 5; i++) expect((await send({ message: "Hello there" }, address)).status).toBe(200);
    expect((await send({ message: "Hello there" }, address)).status).toBe(429);
  });

  it("answers 502 when Resend fails, with no detail", async () => {
    resend.mockResolvedValueOnce(new Response("secret detail", { status: 500 }));
    const res = await send({ message: "Hello there" });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret|re_test/);
  });
});
