// Sends a file to /api/convert with real upload progress, a time limit and a way to cancel.
// The converted file comes back in the same response; nothing is kept on the server.

export interface Converted {
  blob: Blob;
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
    xhr.responseType = "blob";
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
    xhr.onload = async () => {
      const blob = xhr.response as Blob | null;
      if (xhr.status >= 200 && xhr.status < 300 && blob && blob.size > 0) {
        resolve({ blob, remaining: Number(xhr.getResponseHeader("X-Remaining") ?? 0) || 0 });
        return;
      }
      let message = "The file could not be converted. Please try again.";
      try {
        const data = JSON.parse((await blob?.text()) ?? "") as { error?: string };
        if (data.error) message = data.error;
      } catch {
        // keep the general message
      }
      reject(new UploadError(message, "refused"));
    };
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
