"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, TextArea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";
import { FEEDBACK_MAX } from "@/schemas/feedback";

type State = { kind: "editing" } | { kind: "sending" } | { kind: "sent" } | { kind: "failed"; message: string };

/** A link that opens a short feedback form. The message is e-mailed to the site's owner and not stored. */
export function FeedbackLink({ className, onOpen }: { className?: string; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<State>({ kind: "editing" });
  const path = usePathname();

  const close = () => {
    setOpen(false);
    // A sent message is cleared; an unsent one is kept, in case the dialog was closed by accident.
    if (state.kind === "sent") {
      setMessage("");
      setEmail("");
      setState({ kind: "editing" });
    }
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) {
      setState({ kind: "failed", message: "Please write a little more." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email, page: path, website }),
      });
      if (res.ok) setState({ kind: "sent" });
      else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setState({ kind: "failed", message: data?.error ?? "Your message could not be sent. Please try again." });
      }
    } catch {
      setState({
        kind: "failed",
        message: navigator.onLine
          ? "The connection was interrupted. Your message is still here; try again."
          : "You are offline. Your message is still here; try again when you are connected.",
      });
    }
  }

  const sending = state.kind === "sending";
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        Send feedback
      </button>
      <Dialog open={open} onClose={close} title="Send feedback">
        {state.kind === "sent" ? (
          <div role="status" className="space-y-4">
            <p className="flex items-start gap-2 text-accent">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span className="text-fg">Thank you. Your message has been sent.</span>
            </p>
            <p className="text-muted">If you left an e-mail address, a reply will come from there.</p>
            <div className="flex justify-end">
              <Button variant="primary" onClick={close}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4" noValidate>
            <p className="text-muted">
              Tell me what is broken, what is missing, or what worked well. The message is e-mailed to me and is not
              stored on this site.
            </p>
            <TextArea
              label="Message"
              required
              value={message}
              maxLength={FEEDBACK_MAX}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
            />
            <Field
              label="E-mail address (optional)"
              hint="Only if you would like a reply."
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
            />
            <p className="text-body-sm text-subtle">
              Sent from <span className="font-mono">{path}</span>
            </p>
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Leave this empty
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>
            {state.kind === "failed" && (
              <Notice tone="error" title="Not sent">
                {state.message}
              </Notice>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={close}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" busy={sending}>
                <MessageSquare className="size-5" aria-hidden /> Send
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
