// The only place that talks to ConvertAPI. The secret never leaves the server.

const BASE = "https://v2.convertapi.com";

export interface ConvertedFile {
  name: string;
  size: number;
  fileId: string;
}

export type ConvertOutcome =
  { ok: true; file: ConvertedFile } | { ok: false; reason: "timeout" | "unauthorised" | "failed" };

export async function convertFile(
  secret: string,
  route: string,
  file: File,
  option?: { name: string; value: string },
  fetcher: typeof fetch = fetch,
): Promise<ConvertOutcome> {
  const body = new FormData();
  body.set("File", file, file.name);
  body.set("StoreFile", "true");
  if (option) body.set(option.name, option.value);
  let res: Response;
  try {
    res = await fetcher(`${BASE}/convert/${route}?Secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(55_000),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "timeout" };
  }
  const data = (await res.json().catch(() => null)) as {
    Files?: { FileName: string; FileSize: number; FileId: string }[];
    Message?: string;
  } | null;
  const first = data?.Files?.[0];
  if (!res.ok || !first) {
    console.error("ConvertAPI error", res.status, data?.Message);
    return { ok: false, reason: res.status === 401 ? "unauthorised" : "failed" };
  }
  return { ok: true, file: { name: first.FileName, size: first.FileSize, fileId: first.FileId } };
}

export const fetchResult = (secret: string, fileId: string, fetcher: typeof fetch = fetch) =>
  fetcher(`${BASE}/d/${fileId}?Secret=${encodeURIComponent(secret)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

/** True when the file is gone from ConvertAPI (a 404 means it already was). */
export async function deleteResult(secret: string, fileId: string, fetcher: typeof fetch = fetch) {
  const res = await fetcher(`${BASE}/d/${fileId}?Secret=${encodeURIComponent(secret)}`, {
    method: "DELETE",
    cache: "no-store",
  }).catch(() => null);
  return Boolean(res && (res.ok || res.status === 404));
}
