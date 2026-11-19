import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/convert/route";

const ZIP = [0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];
let n = 0;
const ip = () => `203.0.113.${++n}`;

function convertRequest(fields: { tool?: string; file?: File | null }, address = ip()) {
  const form = new FormData();
  if (fields.tool !== undefined) form.set("tool", fields.tool);
  if (fields.file) form.set("file", fields.file);
  return new Request("http://localhost/api/convert", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": address },
  });
}

const docx = (name = "letter.docx", size = 64) =>
  new File([new Uint8Array([...ZIP, ...new Array(size - ZIP.length).fill(1)])], name);
const pdf = (name = "a.pdf") => new File([new Uint8Array(PDF)], name);
const pdfBytes = () => new Response(new Uint8Array([...PDF, 1, 2, 3]), { status: 200 });

/** A fake network: Gotenberg, Adobe and a counting store, each recorded so tests can look at the calls. */
interface Net {
  calls: { url: string; init: RequestInit }[];
  gotenberg: () => Response | Promise<Response>;
  adobeJob: () => Response;
  counters: Map<string, number>;
  resultAssetId?: string;
  downloadFails?: boolean;
  uploadFails?: boolean;
}
let net: Net;

function handler(url: string, init: RequestInit = {}): Response | Promise<Response> {
  net.calls.push({ url, init });
  if (url.startsWith("https://store.test/pipeline")) {
    const commands = JSON.parse(String(init.body)) as string[][];
    const key = String(commands[0]?.[1]);
    const next = (net.counters.get(key) ?? 0) + Number(commands[0]?.[2]);
    net.counters.set(key, next);
    return Response.json([{ result: next }, { result: 1 }]);
  }
  if (url.startsWith("https://office.test/forms/libreoffice/convert")) return net.gotenberg();
  if (url === "https://pdf-services.adobe.io/token") return Response.json({ access_token: "tok" });
  if (url === "https://pdf-services.adobe.io/assets" && init.method === "POST")
    return Response.json({ uploadUri: "https://upload.test/put?sig=1", assetID: "asset-1" });
  if (url.startsWith("https://upload.test/")) return new Response(null, { status: net.uploadFails ? 500 : 200 });
  if (url === "https://pdf-services.adobe.io/operation/exportpdf") return net.adobeJob();
  if (/^https:\/\/pdf-services(-ue1)?\.adobe\.io\/operation\/exportpdf\/job-1\/status$/.test(url))
    return Response.json({
      status: "done",
      asset: { downloadUri: "https://download.test/out", ...(net.resultAssetId ? { assetID: net.resultAssetId } : {}) },
    });
  if (url === "https://download.test/out")
    return net.downloadFails ? new Response("x", { status: 500 }) : new Response(new Uint8Array(ZIP), { status: 200 });
  if (url.startsWith("https://pdf-services.adobe.io/assets/") && init.method === "DELETE")
    return new Response(null, { status: 204 });
  return new Response("unexpected", { status: 500 });
}

beforeEach(() => {
  net = {
    calls: [],
    counters: new Map(),
    gotenberg: () => pdfBytes(),
    adobeJob: () =>
      new Response(null, {
        status: 201,
        // Adobe answers with a regional host, as in production.
        headers: { location: "https://pdf-services-ue1.adobe.io/operation/exportpdf/job-1/status" },
      }),
  };
  vi.stubEnv("GOTENBERG_URL", "https://office.test");
  vi.stubEnv("GOTENBERG_USERNAME", "svc");
  vi.stubEnv("GOTENBERG_PASSWORD", "pw-secret");
  vi.stubEnv("PDF_SERVICES_CLIENT_ID", "client-id");
  vi.stubEnv("PDF_SERVICES_CLIENT_SECRET", "client-secret");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://store.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "store-token");
  vi.stubEnv("CONVERT_DAILY_PER_VISITOR", "10");
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string | URL | Request, init?: RequestInit) => Promise.resolve(handler(String(url), init))),
  );
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const upstream = () => net.calls.filter((c) => !c.url.startsWith("https://store.test"));
const adobeCount = (prefix: string) => [...net.counters].find(([k]) => k.startsWith(prefix))?.[1];

describe("POST /api/convert: refusals", () => {
  it("answers 503 when the converter is not set up", async () => {
    vi.stubEnv("GOTENBERG_URL", "");
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }))).status).toBe(503);
    vi.stubEnv("PDF_SERVICES_CLIENT_ID", "");
    expect((await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }))).status).toBe(503);
  });

  it("answers 503 for PDF to Word when there is no shared store, rather than risk the free allowance", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect((await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }))).status).toBe(503);
    expect(upstream()).toHaveLength(0);
  });

  it("answers 503 for Word to PDF too when there is no shared store, so the site-wide cap can be trusted", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const res = await POST(convertRequest({ tool: "word-to-pdf", file: docx() }));
    expect(res.status).toBe(503);
    expect(upstream()).toHaveLength(0);
  });

  it("applies a site-wide cap of 200 a day by default", async () => {
    net.counters.set(`dm:${new Date().toISOString().slice(0, 10)}:site`, 200);
    const res = await POST(convertRequest({ tool: "word-to-pdf", file: docx() }));
    expect(res.status).toBe(429);
    expect(upstream()).toHaveLength(0);
  });

  it("counts every address in one IPv6 /64 as one visitor", async () => {
    vi.stubEnv("CONVERT_DAILY_PER_VISITOR", "1");
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, "2001:db8:1:2:aaaa::1"))).status).toBe(
      200,
    );
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, "2001:db8:1:2:bbbb::9"))).status).toBe(
      429,
    );
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, "2001:db8:1:3::1"))).status).toBe(200);
  });

  it("refuses a result larger than 4.5 MB with a clear message, and keeps the conversion counted", async () => {
    vi.stubEnv("CONVERT_DAILY_PER_VISITOR", "1");
    const address = ip();
    net.gotenberg = () => new Response(new Uint8Array([...PDF, ...new Array(4_600_000).fill(1)]), { status: 200 });
    const res = await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/4\.5 MB/);
    net.gotenberg = () => pdfBytes();
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).status).toBe(429);
    const today = new Date().toISOString().slice(0, 10);
    expect(net.counters.get(`dm:${today}:site`)).toBe(1);
  });

  it("keeps a failed conversion counted once Gotenberg has done the work, so a loop reaches the cap", async () => {
    vi.stubEnv("CONVERT_DAILY_PER_VISITOR", "2");
    const address = ip();
    net.gotenberg = () => new Response("bad file", { status: 500 });
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).status).toBe(502);
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).status).toBe(502);
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).status).toBe(429);
    expect(upstream()).toHaveLength(2);
  });

  it("stops at the daily attempt cap, which is never given back", async () => {
    vi.stubEnv("CONVERT_DAILY_ATTEMPT_CAP", "2");
    net.gotenberg = () => new Response("bad file", { status: 500 });
    for (let i = 0; i < 2; i++)
      expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }))).status).toBe(502);
    const res = await POST(convertRequest({ tool: "word-to-pdf", file: docx() }));
    expect(res.status).toBe(429);
    const today = new Date().toISOString().slice(0, 10);
    expect(net.counters.get(`dm:${today}:attempts`)).toBe(3);
    expect(net.counters.get(`dm:${today}:site`)).toBe(2);
  });

  it("answers 503 when a limit is mistyped, rather than running without it", async () => {
    vi.stubEnv("CONVERT_DAILY_PER_VISITOR", "ten");
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }))).status).toBe(503);
    expect(upstream()).toHaveLength(0);
  });

  it("refuses an unlisted tool (400), including the retired PDF compression", async () => {
    expect((await POST(convertRequest({ tool: "rm-rf", file: docx() }))).status).toBe(400);
    expect((await POST(convertRequest({ tool: "compress-pdf", file: pdf() }))).status).toBe(400);
  });

  it("refuses a missing file (400)", async () => {
    expect((await POST(convertRequest({ tool: "word-to-pdf" }))).status).toBe(400);
  });

  it("refuses a file over 4 MB (413) with a clear message", async () => {
    const res = await POST(convertRequest({ tool: "word-to-pdf", file: docx("big.docx", 4 * 1024 * 1024 + 1) }));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/4 MB/);
  });

  it("refuses a renamed file (415): a PDF called .docx, and a Word file called .pdf", async () => {
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: pdf("fake.docx") }))).status).toBe(415);
    expect((await POST(convertRequest({ tool: "pdf-to-word", file: docx("fake.pdf") }))).status).toBe(415);
    expect(upstream()).toHaveLength(0);
  });
});

describe("Word and Excel to PDF (Gotenberg)", () => {
  it("converts, with basic authentication, and returns the PDF without keeping anything", async () => {
    const res = await POST(convertRequest({ tool: "word-to-pdf", file: docx() }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("x-remaining")).toBe("9");
    expect(new Uint8Array(await res.arrayBuffer()).slice(0, 5)).toEqual(new Uint8Array(PDF.slice(0, 5)));
    const call = upstream()[0];
    expect(call?.url).toBe("https://office.test/forms/libreoffice/convert");
    expect((call?.init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa("svc:pw-secret")}`);
    expect(((call?.init.body as FormData).get("files") as File).name).toBe("letter.docx");
  });

  it("never reveals the service address or its password in an error", async () => {
    net.gotenberg = () => new Response("boom", { status: 500 });
    const res = await POST(convertRequest({ tool: "word-to-pdf", file: docx() }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/office\.test|pw-secret|svc/);
  });

  it("tries once more when the service is waking up, then succeeds", async () => {
    let attempts = 0;
    net.gotenberg = () => (++attempts === 1 ? new Response("starting", { status: 503 }) : pdfBytes());
    const res = await POST(convertRequest({ tool: "word-to-pdf", file: docx() }));
    expect(res.status).toBe(200);
    expect(attempts).toBe(2);
  });

  it("gives up after the second failed attempt (502) and gives the conversion back", async () => {
    vi.stubEnv("CONVERT_DAILY_PER_VISITOR", "1");
    const address = ip();
    net.gotenberg = () => new Response("down", { status: 503 });
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).status).toBe(502);
    net.gotenberg = () => pdfBytes();
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).status).toBe(200);
  });

  it("answers 502 when the service rejects the credentials, without detail", async () => {
    net.gotenberg = () => new Response("no", { status: 401 });
    const res = await POST(convertRequest({ tool: "word-to-pdf", file: docx() }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).not.toMatch(/401|password|credential/i);
  });

  it("refuses output that is not a PDF", async () => {
    net.gotenberg = () => new Response("<html>error</html>", { status: 200 });
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }))).status).toBe(502);
  });

  it("stops at the daily limit (429)", async () => {
    vi.stubEnv("CONVERT_DAILY_PER_VISITOR", "1");
    const address = ip();
    expect((await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address))).status).toBe(200);
    const second = await POST(convertRequest({ tool: "word-to-pdf", file: docx() }, address));
    expect(second.status).toBe(429);
    expect((await second.json()).error).toMatch(/tomorrow/);
  });
});

describe("PDF to Word and Excel (Adobe PDF Services)", () => {
  it("runs the whole flow, in order, and returns the Word file", async () => {
    const res = await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("wordprocessingml");
    expect(upstream().map((c) => `${c.init.method ?? "GET"} ${new URL(c.url).pathname}`)).toEqual([
      "POST /token",
      "POST /assets",
      "PUT /put",
      "POST /operation/exportpdf",
      "GET /operation/exportpdf/job-1/status",
      "GET /out",
      "DELETE /assets/asset-1",
    ]);
    const job = upstream()[3];
    expect(JSON.parse(String(job?.init.body))).toMatchObject({ assetID: "asset-1", targetFormat: "docx" });
    expect((job?.init.headers as Record<string, string>)["x-api-key"]).toBe("client-id");
    expect(adobeCount("dm:adobe:m:")).toBe(1);
  });

  it("asks for xlsx for PDF to Excel", async () => {
    const res = await POST(convertRequest({ tool: "pdf-to-excel", file: pdf() }));
    expect(res.status).toBe(200);
    expect(JSON.parse(String(upstream()[3]?.init.body))).toMatchObject({ targetFormat: "xlsx" });
    expect(res.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("says it is busy when the daily cap is reached, without calling Adobe or using the visitor's allowance", async () => {
    vi.stubEnv("ADOBE_DAILY_CAP", "1");
    expect((await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }))).status).toBe(200);
    const before = upstream().length;
    const res = await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe(
      "PDF to Word is busy today, please try tomorrow. The tools that run in your browser still work.",
    );
    expect(upstream().length).toBe(before);
    expect(adobeCount("dm:adobe:d:")).toBe(1);
    expect(adobeCount("dm:adobe:m:")).toBe(1);
  });

  it("says it is busy when the monthly cap is reached", async () => {
    vi.stubEnv("ADOBE_MONTHLY_CAP", "1");
    expect((await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }))).status).toBe(200);
    expect((await POST(convertRequest({ tool: "pdf-to-excel", file: pdf() }))).status).toBe(503);
  });

  it("gives the allowance back when Adobe fails", async () => {
    net.adobeJob = () => new Response("bad", { status: 400 });
    const res = await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }));
    expect(res.status).toBe(502);
    expect(adobeCount("dm:adobe:m:")).toBe(0);
    expect(adobeCount("dm:adobe:d:")).toBe(0);
  });

  it("deletes both the uploaded file and the result at Adobe", async () => {
    net.resultAssetId = "result-9";
    await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }));
    const deletes = upstream()
      .filter((c) => c.init.method === "DELETE")
      .map((c) => new URL(c.url).pathname);
    expect(deletes.sort()).toEqual(["/assets/asset-1", "/assets/result-9"]);
  });

  it("keeps the allowance spent when the job was accepted and a later step fails", async () => {
    net.downloadFails = true;
    const res = await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }));
    expect(res.status).toBe(502);
    expect(adobeCount("dm:adobe:m:")).toBe(1);
    expect(adobeCount("dm:adobe:d:")).toBe(1);
  });

  it("keeps the allowance spent when the export request times out, because Adobe may have accepted it", async () => {
    net.adobeJob = () => {
      throw new DOMException("timed out", "TimeoutError");
    };
    const res = await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }));
    expect(res.status).toBe(504);
    expect(adobeCount("dm:adobe:m:")).toBe(1);
    expect(adobeCount("dm:adobe:d:")).toBe(1);
  });

  it("gives the allowance back when it fails before the job is accepted (upload)", async () => {
    net.uploadFails = true;
    const res = await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }));
    expect(res.status).toBe(502);
    expect(adobeCount("dm:adobe:m:")).toBe(0);
  });

  it("treats Adobe's rate limit as busy (503)", async () => {
    net.adobeJob = () => new Response("slow down", { status: 429 });
    expect((await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }))).status).toBe(503);
  });

  it("never reveals the credentials", async () => {
    const res = await POST(convertRequest({ tool: "pdf-to-word", file: pdf() }));
    expect(JSON.stringify([...res.headers])).not.toMatch(/client-secret|tok/);
  });
});

describe("Adobe status addresses", () => {
  it("trusts Adobe's regional hosts and nothing else", async () => {
    const { isAdobeServiceUrl } = await import("@/server/adobe");
    expect(isAdobeServiceUrl("https://pdf-services.adobe.io/operation/exportpdf/1/status")).toBe(true);
    expect(isAdobeServiceUrl("https://pdf-services-ue1.adobe.io/operation/exportpdf/1/status")).toBe(true);
    expect(isAdobeServiceUrl("https://pdf-services-ew1.adobe.io/assets/1")).toBe(true);
    expect(isAdobeServiceUrl("http://pdf-services-ue1.adobe.io/x")).toBe(false);
    expect(isAdobeServiceUrl("https://pdf-services.adobe.io.evil.test/x")).toBe(false);
    expect(isAdobeServiceUrl("https://evil.test/pdf-services.adobe.io/")).toBe(false);
  });
});
