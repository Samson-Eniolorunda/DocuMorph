import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/convert/route";
import { DELETE, GET } from "@/app/api/convert/result/route";

const ZIP = [0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];
let n = 0;
const ip = () => `203.0.113.${++n}`;

function convertRequest(fields: { tool?: string; file?: File | null; option?: string }, address = ip()) {
  const form = new FormData();
  if (fields.tool !== undefined) form.set("tool", fields.tool);
  if (fields.file) form.set("file", fields.file);
  if (fields.option) form.set("option", fields.option);
  return new Request("http://localhost/api/convert", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": address },
  });
}

const docx = (name = "letter.docx", size = 64) =>
  new File([new Uint8Array([...ZIP, ...new Array(size - ZIP.length).fill(1)])], name);
const pdf = (name = "a.pdf") => new File([new Uint8Array(PDF)], name);

const converted = { Files: [{ FileName: "letter.pdf", FileSize: 1234, FileId: "abcdef1234567890" }] };

let upstream: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("CONVERTAPI_SECRET", "test-secret");
  vi.stubEnv("CONVERT_DAILY_PER_VISITOR", "10");
  upstream = vi.fn();
  vi.stubGlobal("fetch", upstream);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("POST /api/convert", () => {
  it("answers 503 when the secret is not set", async () => {
    vi.stubEnv("CONVERTAPI_SECRET", "");
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }))).status).toBe(503);
  });

  it("answers 503 when a limit is mistyped, rather than running without it", async () => {
    vi.stubEnv("CONVERT_DAILY_PER_VISITOR", "ten");
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }))).status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses an unlisted tool (400)", async () => {
    expect((await POST(convertRequest({ tool: "rm-rf", file: docx() }))).status).toBe(400);
  });

  it("refuses a missing file (400)", async () => {
    expect((await POST(convertRequest({ tool: "word-to-pdf" }))).status).toBe(400);
  });

  it("refuses a file over 4 MB (413)", async () => {
    expect(
      (await POST(convertRequest({ tool: "word-to-pdf", file: docx("big.docx", 4 * 1024 * 1024 + 1) }))).status,
    ).toBe(413);
  });

  it("refuses a renamed file (415): a PDF called .docx, and a Word file called .pdf", async () => {
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: pdf("fake.docx") }))).status).toBe(415);
    expect((await POST(convertRequest({ tool: "pdf-to-word", file: docx("fake.pdf") }))).status).toBe(415);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses an unlisted option (400)", async () => {
    expect((await POST(convertRequest({ tool: "compress-pdf", file: pdf(), option: "extreme" }))).status).toBe(400);
  });

  it("converts, and returns a token and the remaining allowance, never the secret or the ConvertAPI address", async () => {
    upstream.mockResolvedValueOnce(ok(converted));
    const res = await POST(convertRequest({ tool: "word-to-pdf", file: docx() }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ name: "letter.pdf", size: 1234, fileId: "abcdef1234567890", remaining: 9 });
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{16,}$/);
    expect(JSON.stringify(body)).not.toContain("test-secret");
    expect(JSON.stringify(body)).not.toContain("convertapi");
  });

  it("stops at the daily limit (429)", async () => {
    vi.stubEnv("CONVERT_DAILY_PER_VISITOR", "1");
    const address = ip();
    upstream.mockResolvedValue(ok(converted));
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).status).toBe(200);
    const second = await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address));
    expect(second.status).toBe(429);
    expect((await second.json()).error).toMatch(/tomorrow/);
  });

  it("does not use up the allowance when the conversion fails", async () => {
    vi.stubEnv("CONVERT_DAILY_PER_VISITOR", "1");
    const address = ip();
    upstream.mockResolvedValueOnce(new Response(JSON.stringify({ Message: "bad" }), { status: 400 }));
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).status).toBe(502);
    upstream.mockResolvedValueOnce(ok(converted));
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).status).toBe(200);
  });

  it("answers 504 when ConvertAPI does not answer, and gives the conversion back", async () => {
    vi.stubEnv("CONVERT_DAILY_PER_VISITOR", "1");
    const address = ip();
    upstream.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).status).toBe(504);
    upstream.mockResolvedValueOnce(ok(converted));
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).status).toBe(200);
  });

  it("answers 502 without detail when ConvertAPI refuses the secret", async () => {
    upstream.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    const res = await POST(convertRequest({ tool: "word-to-pdf", file: docx() }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).not.toMatch(/secret|401/i);
  });
});

describe("result route", () => {
  async function issue(address: string) {
    upstream.mockResolvedValueOnce(ok(converted));
    return (await (await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).json()) as {
      fileId: string;
      token: string;
    };
  }
  const call = (method: "GET" | "DELETE", fileId: string, token: string, address: string) =>
    (method === "GET" ? GET : DELETE)(
      new Request(`http://localhost/api/convert/result?fileId=${fileId}&token=${token}`, {
        method,
        headers: { "x-forwarded-for": address },
      }),
    );

  it("sends the file to the visitor who made it, then deletes it from ConvertAPI", async () => {
    const address = ip();
    const { fileId, token } = await issue(address);
    upstream
      .mockResolvedValueOnce(new Response("PDFDATA", { headers: { "content-type": "application/pdf" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const res = await call("GET", fileId, token, address);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("PDFDATA");
    const deleteCall = upstream.mock.calls[2] as [string, RequestInit];
    expect(deleteCall[0]).toContain(`/d/${fileId}`);
    expect(deleteCall[1].method).toBe("DELETE");
  });

  it("refuses another visitor's token (403) and makes no call to ConvertAPI", async () => {
    const { fileId, token } = await issue(ip());
    const before = upstream.mock.calls.length;
    expect((await call("GET", fileId, token, ip())).status).toBe(403);
    expect((await call("DELETE", fileId, token, ip())).status).toBe(403);
    expect(upstream.mock.calls.length).toBe(before);
  });

  it("refuses a malformed identifier or token (400)", async () => {
    const address = ip();
    expect((await call("DELETE", "../../etc", "x", address)).status).toBe(400);
    expect((await call("GET", "short", "short", address)).status).toBe(400);
  });

  it("deletes on request, and treats an already-deleted file as deleted", async () => {
    const address = ip();
    const { fileId, token } = await issue(address);
    upstream.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const res = await call("DELETE", fileId, token, address);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
  });

  it("limits how often results can be fetched", async () => {
    const address = ip();
    const { fileId, token } = await issue(address);
    upstream.mockResolvedValue(new Response(null, { status: 404 }));
    let last = 200;
    for (let i = 0; i < 65; i++) last = (await call("DELETE", fileId, token, address)).status;
    expect(last).toBe(429);
  });
});
