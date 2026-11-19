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
/**
 * Adobe answers with regional hosts for job and asset addresses (for example pdf-services-ue1.adobe.io), so a
 * returned address is trusted when it is HTTPS on pdf-services[-region].adobe.io and nowhere else.
 */
export const isAdobeServiceUrl = (url: string) => /^https:\/\/pdf-services(?:-[a-z0-9]+)?\.adobe\.io\//.test(url);

export type AdobeTarget = "docx" | "xlsx";
type Reason = "timeout" | "unauthorised" | "quota" | "failed";
/**
 * `accepted` is true once Adobe accepted the export job: from then on the free allowance may have been spent,
 * so it must not be given back. `cleanup` deletes the uploaded file and the result from Adobe; the caller runs it
 * after the response has been sent, so the visitor is not kept waiting.
 */
export type AdobeOutcome = { accepted: boolean; cleanup: () => Promise<void> } & (
  { ok: true; bytes: Uint8Array } | { ok: false; reason: Reason }
);

const MEDIA: Record<AdobeTarget, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
/** The first bytes of a .docx or .xlsx file, which is a ZIP container. */
const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Stop extends Error {
  constructor(readonly reason: Reason) {
    super(reason);
  }
}

export async function exportPdf(
  config: AdobeConfig,
  file: File,
  target: AdobeTarget,
  {
    budgetMs = 45_000,
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
    lastStatus = res.status;
    if (res.status === 401 || res.status === 403) throw new Stop("unauthorised");
    if (res.status === 429) throw new Stop("quota");
    if (!res.ok) throw new Stop("failed");
  };

  const assets: string[] = [];
  let access = "";
  let accepted = false;
  // For the server log only: which step failed and Adobe's HTTP status (never keys, tokens or file names).
  let step = "token";
  let lastStatus = 0;
  const cleanup = async () => {
    if (!access) return;
    // Best effort and bounded: the upload and the result are both removed.
    await Promise.all(
      assets.map((id) =>
        fetcher(`${BASE}/assets/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${access}`, "x-api-key": config.clientId },
          signal: AbortSignal.timeout(4_000),
          cache: "no-store",
        }).catch(() => undefined),
      ),
    );
  };
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

    step = "asset";
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
    assets.push(assetID);

    step = "upload";
    status(
      await call(uploadUri, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: new Uint8Array(await file.arrayBuffer()),
      }),
    );

    // If this request times out, Adobe may already have accepted the job, so the unit must not be released.
    step = "export";
    let job: Response;
    try {
      job = await call(`${BASE}/operation/exportpdf`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ assetID, targetFormat: target, ocrLang: "en-US" }),
      });
    } catch (err) {
      if (err instanceof Stop && err.reason === "timeout") accepted = true;
      throw err;
    }
    status(job);
    accepted = true;
    const location = job.headers.get("location");
    if (!location || !isAdobeServiceUrl(location)) throw new Stop("failed");
    step = "poll";

    for (;;) {
      await sleep(Math.min(pollMs, Math.max(0, left() - 500)));
      const poll = await call(location, { headers });
      status(poll);
      const state = (await poll.json().catch(() => null)) as {
        status?: string;
        asset?: { downloadUri?: string; assetID?: string };
        resource?: { downloadUri?: string };
      } | null;
      if (state?.status === "failed") throw new Stop("failed");
      if (state?.status === "done") {
        const resultId = state.asset?.assetID;
        if (resultId && !assets.includes(resultId)) assets.push(resultId);
        const downloadUri = state.asset?.downloadUri ?? state.resource?.downloadUri;
        if (!downloadUri) throw new Stop("failed");
        step = "download";
        const out = await call(downloadUri, {});
        status(out);
        const bytes = new Uint8Array(await out.arrayBuffer());
        if (!isZip(bytes)) throw new Stop("failed");
        return { ok: true, bytes, accepted, cleanup };
      }
    }
  } catch (err) {
    const reason = err instanceof Stop ? err.reason : "failed";
    console.error(`[adobe] ${target} failed at ${step}: ${reason}${lastStatus ? ` (HTTP ${lastStatus})` : ""}`);
    return { ok: false, reason, accepted, cleanup };
  }
}

export const adobeMediaType = (t: AdobeTarget) => MEDIA[t];
