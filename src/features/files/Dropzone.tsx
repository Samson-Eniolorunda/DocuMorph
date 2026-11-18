"use client";

import { useId, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { formatBytes, sniff, type FileKind } from "@/lib/files";

const LABELS: Partial<Record<FileKind, string>> = {
  pdf: "PDF",
  jpg: "JPG",
  png: "PNG",
  webp: "WebP",
  "zip-office": "Office",
  "ole-office": "Office",
};
const MIME: Partial<Record<FileKind, string>> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export interface Picked {
  file: File;
  kind: FileKind;
}

/**
 * File picker with drag and drop. Files are checked by their contents, so a
 * renamed file is refused with a clear message, and by size.
 */
export function Dropzone({
  kinds,
  extensions,
  multiple = false,
  maxBytes,
  onFiles,
  hint,
}: {
  kinds: FileKind[];
  /** For office files the extension also matters (.docx vs .xlsx). */
  extensions?: string[];
  multiple?: boolean;
  maxBytes: number;
  onFiles: (files: [Picked, ...Picked[]]) => void;
  hint?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");

  const accept = extensions
    ? extensions.map((e) => `.${e}`).join(",")
    : kinds
        .map((k) => MIME[k])
        .filter(Boolean)
        .join(",");
  const named = extensions ? extensions.map((e) => e.toUpperCase()).join(", ") : kinds.map((k) => LABELS[k]).join(", ");

  async function take(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    const files = multiple ? Array.from(list) : Array.from(list).slice(0, 1);
    const ok: Picked[] = [];
    const problems: string[] = [];
    for (const file of files) {
      const kind = await sniff(file);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!kinds.includes(kind) || (extensions && !extensions.includes(ext)))
        problems.push(`"${file.name}" is not a ${named} file.`);
      else if (file.size > maxBytes)
        problems.push(`"${file.name}" is ${formatBytes(file.size)}; the limit here is ${formatBytes(maxBytes)}.`);
      else ok.push({ file, kind });
    }
    if (problems.length) setError(problems.join(" "));
    const [first, ...rest] = ok;
    if (first) onFiles([first, ...rest]);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          over ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-subtle"
        }`}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Upload className="size-5" />
        </span>
        <span className="font-medium">
          {multiple ? "Choose files" : "Choose a file"}{" "}
          <span className="font-normal text-muted">or drop {multiple ? "them" : "it"} here</span>
        </span>
        <span className="text-xs text-subtle">
          {named} · up to {formatBytes(maxBytes)}
          {multiple ? " each" : ""}
          {hint ? ` · ${hint}` : ""}
        </span>
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => void take(e.target.files)}
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
