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
