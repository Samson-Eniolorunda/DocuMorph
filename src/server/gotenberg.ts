// The only place that talks to Gotenberg (LibreOffice) for Word and Excel to PDF.
// The file is sent, converted and returned; nothing is stored here.

import type { GotenbergConfig } from "./env";

export type OfficeOutcome =
  { ok: true; bytes: Uint8Array } | { ok: false; reason: "timeout" | "unauthorised" | "unavailable" | "failed" };

const COLD_START_STATUSES = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Converts one Office file to PDF. A service scaled to zero needs a few seconds to wake, so a connection
 * failure or a 502, 503 or 504 is tried once more. Both attempts share one time budget.
 */
export async function officeToPdf(
  config: GotenbergConfig,
  file: File,
  {
    budgetMs = 55_000,
    retryDelayMs = 2_000,
    fetcher = fetch,
  }: { budgetMs?: number; retryDelayMs?: number; fetcher?: typeof fetch } = {},
): Promise<OfficeOutcome> {
  const started = Date.now();
  const auth = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  let lastFailure: "timeout" | "unavailable" = "unavailable";

  for (let attempt = 0; attempt < 2; attempt++) {
    const left = budgetMs - (Date.now() - started);
    if (left < 3_000) return { ok: false, reason: "timeout" };
    const body = new FormData();
    // Gotenberg picks the LibreOffice filter from the extension, so the name is kept.
    body.set("files", new Blob([bytes]), file.name.replace(/[^\w.\- ]+/g, "_") || "document");
    let res: Response;
    try {
      res = await fetcher(`${config.url}/forms/libreoffice/convert`, {
        method: "POST",
        headers: { Authorization: auth },
        body,
        signal: AbortSignal.timeout(left),
        cache: "no-store",
      });
    } catch (err) {
      lastFailure = err instanceof DOMException && err.name === "TimeoutError" ? "timeout" : "unavailable";
      if (lastFailure === "timeout") return { ok: false, reason: "timeout" };
      if (attempt === 0) await sleep(retryDelayMs);
      continue;
    }
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "unauthorised" };
    if (COLD_START_STATUSES.has(res.status)) {
      lastFailure = "unavailable";
      await res.body?.cancel().catch(() => undefined);
      if (attempt === 0) await sleep(retryDelayMs);
      continue;
    }
    if (!res.ok) return { ok: false, reason: "failed" };
    const out = new Uint8Array(await res.arrayBuffer().catch(() => new ArrayBuffer(0)));
    // A PDF starts with "%PDF-"; anything else is not a result.
    if (out.length < 5 || String.fromCharCode(...out.slice(0, 5)) !== "%PDF-") return { ok: false, reason: "failed" };
    return { ok: true, bytes: out };
  }
  return { ok: false, reason: lastFailure };
}
