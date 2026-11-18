// Saving results on the visitor's device.

export interface OutputFile {
  name: string;
  blob: Blob;
}

export function download({ name, blob }: OutputFile) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start the download before releasing the file.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function zip(files: OutputFile[], name: string): Promise<OutputFile> {
  const { default: JSZip } = await import("jszip");
  const z = new JSZip();
  const used = new Set<string>();
  for (const f of files) {
    let n = f.name;
    for (let i = 2; used.has(n); i++) n = f.name.replace(/(\.[^.]+)?$/, `-${i}$1`);
    used.add(n);
    z.file(n, f.blob);
  }
  return { name, blob: await z.generateAsync({ type: "blob" }) };
}

export const pdfBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: "application/pdf" });

export const readBytes = async (file: Blob) => new Uint8Array(await file.arrayBuffer());

/** True where the browser can hand files to the system share sheet (Files, WhatsApp, e-mail). */
export function canShare(files: OutputFile[]) {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  return navigator.canShare({ files: files.map((f) => new File([f.blob], f.name, { type: f.blob.type })) });
}

/** Opens the system share sheet. Resolves quietly when the person dismisses it. */
export async function share(files: OutputFile[]) {
  try {
    await navigator.share({ files: files.map((f) => new File([f.blob], f.name, { type: f.blob.type })) });
  } catch (e) {
    if (!(e instanceof DOMException && e.name === "AbortError")) throw e;
  }
}
