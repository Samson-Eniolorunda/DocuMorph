"use client";

// One screen for the three image tools: convert, resize and compress.
// Each works on several images at once and keeps the original names.

import { useState } from "react";
import { Shrink, Repeat, Scaling } from "lucide-react";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button } from "@/components/ui/Button";
import { Checkbox, RadioGroup } from "@/components/ui/Choice";
import { Field, Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";
import { Slider } from "@/components/ui/Slider";
import { Dropzone } from "@/features/files/Dropzone";
import { FileOrder, newId } from "@/features/files/FileOrder";
import { Results, type Dimensions } from "@/features/files/Results";
import type { OutputFile } from "@/lib/download";
import { explain } from "@/lib/errors";
import { DEVICE_MAX_BYTES, MB, renameTo, type FileKind } from "@/lib/files";
import {
  EXT,
  compressToTarget,
  decode,
  draw,
  encode,
  readDimensions,
  targetDimensions,
  type ImageType,
} from "@/lib/image";

export type ImageMode = "convert" | "resize" | "compress";

type Item = { id: string; file: File; kind: FileKind; size: Dimensions | null };

const TYPE_OF: Partial<Record<FileKind, ImageType>> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const FORMATS: [ImageType, string][] = [
  ["image/jpeg", "JPG"],
  ["image/png", "PNG"],
  ["image/webp", "WebP"],
];
const VERB = { convert: "Convert", resize: "Resize", compress: "Compress" } as const;
const ACTION_ICON = { convert: Repeat, resize: Scaling, compress: Shrink } as const;
const MAX_SIDE = 20_000;

const digits = (v: string) => v.replace(/\D/g, "");

export function ImageTool({ mode }: { mode: ImageMode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<ImageType | "same">(mode === "convert" ? "image/jpeg" : "same");
  const [quality, setQuality] = useState(mode === "compress" ? 70 : 90);
  const [resizeBy, setResizeBy] = useState<"size" | "percent">("size");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [percent, setPercent] = useState(50);
  const [keepRatio, setKeepRatio] = useState(true);
  const [compressBy, setCompressBy] = useState<"quality" | "target">("quality");
  const [target, setTarget] = useState("200");
  const [unit, setUnit] = useState<"KB" | "MB">("KB");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<{
    files: OutputFile[];
    before: number;
    note?: string | undefined;
    dimensions?: { before: Dimensions; after: Dimensions } | undefined;
  } | null>(null);

  const targetBytes = Number(target) * (unit === "MB" ? MB : 1024);
  const widthError =
    width && Number(width) > MAX_SIDE
      ? `Use a width of ${MAX_SIDE.toLocaleString("en-GB")} pixels or less.`
      : undefined;
  const heightError =
    height && Number(height) > MAX_SIDE
      ? `Use a height of ${MAX_SIDE.toLocaleString("en-GB")} pixels or less.`
      : undefined;
  const sizeMissing = mode === "resize" && resizeBy === "size" && !Number(width) && !Number(height);
  const targetError =
    mode === "compress" && compressBy === "target" && targetBytes < 5 * 1024
      ? "Use a size of at least 5 KB."
      : undefined;
  const invalid = sizeMissing || Boolean(widthError || heightError || targetError);

  async function add(picked: { file: File; kind: FileKind }[]) {
    const added: Item[] = picked.map((p) => ({ id: newId(), ...p, size: null }));
    setItems((cur) => [...cur, ...added]);
    for (const it of added) {
      const size = await readDimensions(it.file).catch(() => null);
      setItems((cur) => cur.map((x) => (x.id === it.id ? { ...x, size } : x)));
    }
  }

  async function run() {
    setBusy(true);
    setError("");
    try {
      const results: OutputFile[] = [];
      let missed = 0;
      let scaled = 0;
      let dimensions: { before: Dimensions; after: Dimensions } | undefined;
      for (const { file, kind } of items) {
        const bitmap = await decode(file);
        let type = format === "same" ? (TYPE_OF[kind] ?? "image/jpeg") : format;
        // PNG ignores quality, so compressing a PNG means saving it as WebP.
        if (mode === "compress" && type === "image/png") type = "image/webp";
        let blob: Blob;
        let after: Dimensions = { width: bitmap.width, height: bitmap.height };
        if (mode === "resize") {
          const want =
            resizeBy === "percent"
              ? targetDimensions(bitmap, { percent })
              : targetDimensions(
                  bitmap,
                  { width: Number(width) || undefined, height: Number(height) || undefined },
                  keepRatio,
                );
          const canvas = draw(bitmap, want.width, want.height, type);
          if (canvas.width !== want.width) scaled++;
          after = { width: canvas.width, height: canvas.height };
          blob = await encode(canvas, type, quality / 100);
        } else if (mode === "compress" && compressBy === "target") {
          const r = await compressToTarget(bitmap, type, targetBytes);
          if (!r.fits) missed++;
          blob = r.blob;
        } else {
          blob = await encode(draw(bitmap, bitmap.width, bitmap.height, type), type, quality / 100);
        }
        if (items.length === 1) dimensions = { before: { width: bitmap.width, height: bitmap.height }, after };
        bitmap.close();
        results.push({
          name: renameTo(
            file.name,
            EXT[type],
            mode === "convert" ? "" : `-${mode === "resize" ? "resized" : "compressed"}`,
          ),
          blob,
        });
      }
      const notes = [
        missed
          ? `${missed} image${missed === 1 ? "" : "s"} could not reach ${target} ${unit}; the smallest result is given instead.`
          : "",
        scaled
          ? `${scaled} image${scaled === 1 ? " was" : "s were"} too large to draw at the size asked for on this device, so ${scaled === 1 ? "it was" : "they were"} saved a little smaller.`
          : "",
        mode === "compress" && items.some((i) => i.kind === "png")
          ? "PNG images were saved as WebP, because PNG cannot be made smaller by lowering quality."
          : "",
      ].filter(Boolean);
      setOut({
        files: results,
        before: items.reduce((n, f) => n + f.file.size, 0),
        note: notes.join(" ") || undefined,
        dimensions,
      });
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  const reset = () => {
    setOut(null);
    setItems([]);
  };

  if (out)
    return (
      <Results
        files={out.files}
        before={out.before}
        note={out.note}
        dimensions={out.dimensions}
        zipName={`images-${mode}.zip`}
        onReset={reset}
      />
    );

  const Icon = ACTION_ICON[mode];
  return (
    <div className="space-y-5">
      <Dropzone kinds={["jpg", "png", "webp"]} multiple maxBytes={DEVICE_MAX_BYTES} onFiles={(f) => void add(f)} />

      {items.length > 0 && (
        <>
          <FileOrder items={items} onChange={setItems} />
          {items.some((i) => i.size) && (
            <ul className="tabular-nums text-[15px] text-muted">
              {items.map((i) => (
                <li key={i.id} className="truncate">
                  {i.file.name}: {i.size ? `${i.size.width} × ${i.size.height} px` : "reading size…"}
                </li>
              ))}
            </ul>
          )}

          {mode === "resize" && (
            <>
              <RadioGroup
                legend="Resize by"
                value={resizeBy}
                onChange={setResizeBy}
                options={[
                  { value: "size", label: "Width and height", hint: "Leave one blank to work it out from the other." },
                  { value: "percent", label: "Percentage of the original" },
                ]}
              />
              {resizeBy === "size" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Width (px)"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      enterKeyHint="next"
                      value={width}
                      onChange={(e) => setWidth(digits(e.target.value))}
                      placeholder="1200"
                      error={widthError}
                    />
                    <Field
                      label="Height (px)"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      enterKeyHint="done"
                      value={height}
                      onChange={(e) => setHeight(digits(e.target.value))}
                      placeholder="Automatic"
                      error={heightError}
                    />
                  </div>
                  {sizeMissing && <p className="text-body-sm text-subtle">Enter a width or a height.</p>}
                  <Checkbox label="Keep proportions" checked={keepRatio} onChange={setKeepRatio} />
                </div>
              ) : (
                <Slider label="Scale" value={percent} onChange={setPercent} min={5} max={200} step={5} unit="%" />
              )}
            </>
          )}

          {mode === "compress" && (
            <>
              <RadioGroup
                legend="Compress"
                value={compressBy}
                onChange={setCompressBy}
                options={[
                  { value: "quality", label: "By quality" },
                  { value: "target", label: "To a file size" },
                ]}
              />
              {compressBy === "target" && (
                <div className="grid grid-cols-[1fr_7rem] items-start gap-3">
                  <Field
                    label="Largest size per image"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    enterKeyHint="done"
                    value={target}
                    onChange={(e) => setTarget(digits(e.target.value))}
                    error={targetError}
                  />
                  <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as "KB" | "MB")}>
                    <option>KB</option>
                    <option>MB</option>
                  </Select>
                </div>
              )}
            </>
          )}

          <Select label="Format" value={format} onChange={(e) => setFormat(e.target.value as ImageType | "same")}>
            {mode !== "convert" && <option value="same">Keep the same</option>}
            {FORMATS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          {!(mode === "compress" && compressBy === "target") && (
            <Slider label="Quality" value={quality} onChange={setQuality} min={10} max={100} step={5} unit="%" />
          )}
          {mode === "compress" && (
            <p className="text-body-sm text-subtle">
              PNG images are saved as WebP when compressed, because PNG cannot be made smaller by lowering quality.
            </p>
          )}

          {error && <Notice tone="error">{error}</Notice>}
          <ActionBar>
            <Button variant="secondary" size="lg" onClick={reset}>
              Clear
            </Button>
            <Button variant="primary" size="lg" busy={busy} disabled={invalid} onClick={run}>
              <Icon className="size-5" aria-hidden />{" "}
              {busy ? "Working…" : `${VERB[mode]} ${items.length} image${items.length === 1 ? "" : "s"}`}
            </Button>
          </ActionBar>
        </>
      )}
    </div>
  );
}

export const ConvertImage = () => <ImageTool mode="convert" />;
export const ResizeImage = () => <ImageTool mode="resize" />;
export const CompressImage = () => <ImageTool mode="compress" />;
