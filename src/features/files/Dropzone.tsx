"use client";

import { useRef, useState } from "react";
import { Camera, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";
import { formatBytes, sniff, type FileKind } from "@/lib/files";
import { largePdfWarning } from "@/lib/limits";

const LABELS: Partial<Record<FileKind, string>> = {
  pdf: "PDF",
  jpg: "JPG",
  png: "PNG",
  webp: "WebP",
  "zip-office": "Office",
  "ole-office": "Office",
};
const MIME: Partial<Record<FileKind, string>> = {
  pdf: "application/pdf,.pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const OFFICE_MIME: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
};

export interface Picked {
  file: File;
  kind: FileKind;
}

interface Props {
  kinds: FileKind[];
  /** For Office files the extension also matters (.docx or .xlsx). */
  extensions?: string[];
  multiple?: boolean;
  maxBytes: number;
  onFiles: (files: [Picked, ...Picked[]]) => void;
  /** Offers a second button that opens the camera (images only). */
  camera?: boolean;
  /** Tools that can suggest alternatives for a file that is too big. */
  tooLargeAdvice?: string;
}

/**
 * Chooses files. Files are identified by their first bytes, so a renamed file is refused with a clear
 * message. The main control is a real button that opens the phone's own picker; "drop it here" is shown
 * only where there is a mouse.
 */
export function Dropzone({
  kinds,
  extensions,
  multiple = false,
  maxBytes,
  onFiles,
  camera = false,
  tooLargeAdvice,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [warning, setWarning] = useState("");

  const accept = extensions
    ? extensions
        .flatMap((e) => [`.${e}`, OFFICE_MIME[e]])
        .filter(Boolean)
        .join(",")
    : kinds
        .map((k) => MIME[k])
        .filter(Boolean)
        .join(",");
  const named = extensions
    ? extensions.map((e) => `.${e}`).join(" or ")
    : [...new Set(kinds.map((k) => LABELS[k]))].join(", ");

  async function take(list: FileList | null) {
    if (!list?.length) return;
    setProblems([]);
    setWarning("");
    const files = multiple ? Array.from(list) : Array.from(list).slice(0, 1);
    const issues: string[] = [];
    if (!multiple && list.length > 1) issues.push("This tool takes one file at a time, so only the first was used.");
    const ok: Picked[] = [];
    for (const file of files) {
      const kind = await sniff(file);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (kind === "heic")
        issues.push(
          `"${file.name}" is a HEIC photograph. On an iPhone, choose it from Photos instead, or set Settings > Camera > Formats > Most Compatible.`,
        );
      else if (!kinds.includes(kind) || (extensions && !extensions.includes(ext)))
        issues.push(`"${file.name}" is not a ${named} file.`);
      else if (file.size > maxBytes)
        issues.push(
          `"${file.name}" is ${formatBytes(file.size)}. The limit here is ${formatBytes(maxBytes)}.${tooLargeAdvice ? ` ${tooLargeAdvice}` : ""}`,
        );
      else ok.push({ file, kind });
    }
    setProblems(issues);
    const [first, ...rest] = ok;
    if (first) {
      const pdf = ok.find((p) => p.kind === "pdf");
      setWarning((pdf && largePdfWarning(pdf.file)) || "");
      onFiles([first, ...rest]);
    }
    if (input.current) input.current.value = "";
    if (cameraInput.current) cameraInput.current.value = "";
  }

  return (
    <div>
      <div
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
        className={cn(
          "transition-quick rounded-lg border-2 border-dashed p-5 sm:p-8",
          over ? "border-accent bg-accent-tint" : "border-control bg-raised",
        )}
      >
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
          <Button variant="primary" size="lg" className="w-full" onClick={() => input.current?.click()}>
            <FolderOpen className="size-5" aria-hidden /> {multiple ? "Choose files" : "Choose a file"}
          </Button>
          {camera && (
            <Button variant="secondary" size="lg" className="w-full" onClick={() => cameraInput.current?.click()}>
              <Camera className="size-5" aria-hidden /> Take a photo
            </Button>
          )}
          <p className="text-body-sm text-muted">
            {named}, up to <span className="font-mono">{formatBytes(maxBytes)}</span>
            {multiple ? " each" : ""}.
            <span className="hidden [@media(pointer:fine)]:inline"> Or drop {multiple ? "them" : "it"} here.</span>
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept={accept}
          multiple={multiple}
          hidden
          onChange={(e) => void take(e.target.files)}
        />
        {camera && (
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => void take(e.target.files)}
          />
        )}
      </div>
      {problems.length > 0 && (
        <Notice tone="error" className="mt-3">
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </Notice>
      )}
      {warning && (
        <Notice tone="warning" className="mt-3">
          {warning}
        </Notice>
      )}
    </div>
  );
}
