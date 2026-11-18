// The only place that talks to Adobe PDF Services (PDF to Word and PDF to Excel), by its REST interface:
//   1. POST /token                      client id and secret, for a short-lived access token
//   2. POST /assets                     asks for an upload address and an asset id
//   3. PUT  <uploadUri>                 sends the file (no Authorization header on this one)
//   4. POST /operation/exportpdf        starts the job; the job address comes back in the Location header
//   5. GET  <location>                  polled until the status is "done" or "failed"
//   6. GET  <downloadUri>               fetches the result
//   7. DELETE /assets/{assetId}         removes the upload and the result, best effort
// Nothing is stored here. Adobe's own retention is described on the privacy page.

import type { AdobeConfig } from "./env";

const BASE = "https://pdf-services.adobe.io";

export type AdobeTarget = "docx" | "xlsx";
export type AdobeOutcome =
  { ok: true; bytes: Uint8Array } | { ok: false; reason: "timeout" | "unauthorised" | "quota" | "failed" };

const MEDIA: Record<AdobeTarget, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
/** The first bytes of a .docx or .xlsx file, which is a ZIP container. */
const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Stop extends Error {
  constructor(readonly reason: "timeout" | "unauthorised" | "quota" | "failed") {
    super(reason);
  }
}

export async function exportPdf(
  config: AdobeConfig,
  file: File,
  target: AdobeTarget,
  {
    budgetMs = 55_000,
    pollMs = 1_500,
    fetcher = fetch,
  }: { budgetMs?: number; pollMs?: number; fetcher?: typeof fetch } = {},
): Promise<AdobeOutcome> {
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);
  const call = async (url: string, init: RequestInit) => {
    if (left() < 1_000) throw new Stop("timeout");
    try {
      return await fetcher(url, { ...init, signal: AbortSignal.timeout(left()), cache: "no-store" });
    } catch (err) {
      throw new Stop(err instanceof DOMException && err.name === "TimeoutError" ? "timeout" : "failed");
    }
  };
  const status = (res: Response) => {
    if (res.status === 401 || res.status === 403) throw new Stop("unauthorised");
    if (res.status === 429) throw new Stop("quota");
    if (!res.ok) throw new Stop("failed");
  };

  let assetId: string | null = null;
  let access = "";
  try {
    const tokenRes = await call(`${BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret }),
    });
    status(tokenRes);
    access = ((await tokenRes.json().catch(() => null)) as { access_token?: string } | null)?.access_token ?? "";
    if (!access) throw new Stop("unauthorised");
    const headers = { Authorization: `Bearer ${access}`, "x-api-key": config.clientId };

    const slot = await call(`${BASE}/assets`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ mediaType: "application/pdf" }),
    });
    status(slot);
    const { uploadUri, assetID } = ((await slot.json().catch(() => null)) ?? {}) as {
      uploadUri?: string;
      assetID?: string;
    };
    if (!uploadUri || !assetID) throw new Stop("failed");
    assetId = assetID;

    status(
      await call(uploadUri, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: new Uint8Array(await file.arrayBuffer()),
      }),
    );

    const job = await call(`${BASE}/operation/exportpdf`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ assetID, targetFormat: target, ocrLang: "en-US" }),
    });
    status(job);
    const location = job.headers.get("location");
    if (!location || !location.startsWith(`${BASE}/`)) throw new Stop("failed");

    for (;;) {
      await sleep(Math.min(pollMs, Math.max(0, left() - 500)));
      const poll = await call(location, { headers });
      status(poll);
      const state = (await poll.json().catch(() => null)) as {
        status?: string;
        asset?: { downloadUri?: string };
        resource?: { downloadUri?: string };
      } | null;
      if (state?.status === "failed") throw new Stop("failed");
      if (state?.status === "done") {
        const downloadUri = state.asset?.downloadUri ?? state.resource?.downloadUri;
        if (!downloadUri) throw new Stop("failed");
        const out = await call(downloadUri, {});
        status(out);
        const bytes = new Uint8Array(await out.arrayBuffer());
        if (!isZip(bytes)) throw new Stop("failed");
        return { ok: true, bytes };
      }
    }
  } catch (err) {
    return { ok: false, reason: err instanceof Stop ? err.reason : "failed" };
  } finally {
    if (assetId && access) {
      // Best effort and bounded: the visitor is not kept waiting for it.
      await fetcher(`${BASE}/assets/${encodeURIComponent(assetId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${access}`, "x-api-key": config.clientId },
        signal: AbortSignal.timeout(4_000),
        cache: "no-store",
      }).catch(() => undefined);
    }
  }
}

export const adobeMediaType = (t: AdobeTarget) => MEDIA[t];
