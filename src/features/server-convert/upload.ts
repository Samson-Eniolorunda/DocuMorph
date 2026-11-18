// Sends a file to /api/convert with real upload progress, a time limit and a way to cancel.

export interface Converted {
  name: string;
  size: number;
  fileId: string;
  token: string;
  remaining: number;
}

export class UploadError extends Error {
  constructor(
    message: string,
    readonly kind: "offline" | "timeout" | "cancelled" | "refused",
  ) {
    super(message);
  }
}

export function upload(
  form: FormData,
  {
    onProgress,
    onUploaded,
    signal,
    timeoutMs = 70_000,
  }: { onProgress: (percent: number) => void; onUploaded: () => void; signal: AbortSignal; timeoutMs?: number },
) {
  return new Promise<Converted>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/convert");
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.upload.onload = onUploaded;
    xhr.onerror = () =>
      reject(
        new UploadError(
          navigator.onLine
            ? "The connection was interrupted. Your file is still here; try again."
            : "You are offline. Your file is still here; try again when you are connected.",
          "offline",
        ),
      );
    xhr.ontimeout = () =>
      reject(
        new UploadError(
          "This is taking too long. Your file is still here; try again, or try a smaller file.",
          "timeout",
        ),
      );
    xhr.onabort = () => reject(new UploadError("Cancelled.", "cancelled"));
    xhr.onload = () => {
      let data: (Partial<Converted> & { error?: string }) | null = null;
      try {
        data = JSON.parse(xhr.responseText) as Partial<Converted> & { error?: string };
      } catch {
        data = null;
      }
      if (
        xhr.status >= 200 &&
        xhr.status < 300 &&
        data?.name !== undefined &&
        data.size !== undefined &&
        data.fileId &&
        data.token
      ) {
        resolve({
          name: data.name,
          size: data.size,
          fileId: data.fileId,
          token: data.token,
          remaining: data.remaining ?? 0,
        });
      } else reject(new UploadError(data?.error ?? "The file could not be converted. Please try again.", "refused"));
    };
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

/** Fetches the converted file from this site. The server deletes it from ConvertAPI once it has been sent. */
export async function fetchConverted(c: Converted): Promise<Blob> {
  const res = await fetch(
    `/api/convert/result?fileId=${encodeURIComponent(c.fileId)}&token=${encodeURIComponent(c.token)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new UploadError(
      data?.error ?? "The converted file could not be downloaded. Please convert it again.",
      "refused",
    );
  }
  return res.blob();
}
