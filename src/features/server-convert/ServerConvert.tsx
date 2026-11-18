"use client";

import { useRef, useState } from "react";
import { Cloud } from "lucide-react";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button } from "@/components/ui/Button";
import { Notice, ProgressBar } from "@/components/ui/Feedback";
import { serverToolBySlug, type ServerTool } from "@/config/server-tools";
import { Dropzone } from "@/features/files/Dropzone";
import { Results } from "@/features/files/Results";
import type { OutputFile } from "@/lib/download";
import { SERVER_MAX_BYTES, formatBytes, renameTo } from "@/lib/files";
import { upload, UploadError } from "./upload";

type Stage = { kind: "idle" } | { kind: "uploading"; percent: number } | { kind: "converting" };

export function ServerConvert({ slug }: { slug: string }) {
  const tool = serverToolBySlug(slug);
  return tool ? <ServerConvertTool tool={tool} /> : null;
}

function ServerConvertTool({ tool }: { tool: ServerTool }) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ file: OutputFile; before: number; remaining: number } | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function run() {
    if (!file) return;
    setError("");
    setStage({ kind: "uploading", percent: 0 });
    const controller = new AbortController();
    abort.current = controller;
    try {
      const form = new FormData();
      form.set("tool", tool.slug);
      form.set("file", file);
      const converted = await upload(form, {
        signal: controller.signal,
        onProgress: (percent) => setStage({ kind: "uploading", percent }),
        onUploaded: () => setStage({ kind: "converting" }),
      });
      setDone({
        file: { name: renameTo(file.name, tool.outExt), blob: converted.blob },
        before: file.size,
        remaining: converted.remaining,
      });
    } catch (e) {
      if (!(e instanceof UploadError && e.kind === "cancelled"))
        setError(e instanceof Error ? e.message : "The file could not be converted.");
    } finally {
      setStage({ kind: "idle" });
      abort.current = null;
    }
  }

  const reset = () => {
    setDone(null);
    setFile(null);
    setError("");
  };

  if (done)
    return (
      <div className="space-y-3">
        <Results files={[done.file]} before={done.before} onReset={reset} />
        <p className="text-body-sm text-subtle">
          Your file was not kept on the server. You have <span className="font-mono">{done.remaining}</span> server
          conversion{done.remaining === 1 ? "" : "s"} left today.
        </p>
      </div>
    );

  if (!file)
    return (
      <div className="space-y-3">
        <Dropzone
          where="server"
          kinds={tool.kinds}
          extensions={tool.accept}
          maxBytes={SERVER_MAX_BYTES}
          tooLargeAdvice="Tools that run on your device, such as Compress PDF or Split PDF, take files up to 100 MB."
          onFiles={([p]) => setFile(p.file)}
        />
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    );

  const working = stage.kind !== "idle";
  const label =
    stage.kind === "uploading" ? `Uploading ${stage.percent}%` : stage.kind === "converting" ? "Converting…" : "";

  return (
    <div className="space-y-5">
      <p className="min-w-0 truncate text-muted">
        {file.name}, <span className="font-mono">{formatBytes(file.size)}</span>
      </p>
      {error && (
        <Notice tone="error" title="The file was not converted">
          {error}
        </Notice>
      )}
      <ActionBar
        status={
          working ? (
            <div>
              <p className="mb-1 font-mono">{label}</p>
              <ProgressBar label={label} value={stage.kind === "uploading" ? stage.percent : undefined} />
            </div>
          ) : undefined
        }
      >
        {working ? (
          <Button variant="secondary" size="lg" onClick={() => abort.current?.abort()}>
            Cancel
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="lg" onClick={() => setFile(null)}>
              Change file
            </Button>
            <Button variant="primary" size="lg" onClick={run}>
              <Cloud className="size-5" aria-hidden /> {error ? "Try again" : tool.name}
            </Button>
          </>
        )}
      </ActionBar>
    </div>
  );
}
