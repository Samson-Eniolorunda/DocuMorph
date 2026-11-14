import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Which DocuMorph tools keep your files on your device, and what happens to files sent for server conversion.",
};

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-muted">Plainly: what happens to your files.</p>

      <h2 className="mt-10 text-xl font-semibold">Tools that run on your device</h2>
      <p className="mt-2 text-muted">
        Edit PDF, Merge, Split, Organise pages, Images to PDF, PDF to images, and the image tools work entirely in your
        browser. Your files are opened and changed on your device and are never uploaded. You can check this in your
        browser&apos;s developer tools (Network tab): no file is sent while you use them.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Tools that use a server</h2>
      <p className="mt-2 text-muted">
        Word to PDF, PDF to Word, Excel to PDF, PDF to Excel and Compress PDF need a conversion server. For these, your
        file (up to 4 MB) is sent through DocuMorph directly to{" "}
        <a href="https://www.convertapi.com" className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
          ConvertAPI
        </a>
        . DocuMorph does not store it. ConvertAPI keeps the converted file for up to 3 hours so you can download it; after
        downloading, you can delete it straight away with the &quot;Delete it now&quot; button.
      </p>

      <h2 className="mt-10 text-xl font-semibold">What is recorded</h2>
      <p className="mt-2 text-muted">
        To stop the server tools being misused, DocuMorph counts server conversions per visitor per day. Visitors are
        counted by a scrambled (hashed) form of their IP address that changes every day; the address itself is not kept.
        There are no accounts, no advertising and no tracking cookies. Your light or dark theme choice is saved in your
        own browser.
      </p>

      <p className="mt-10">
        <Link href="/" className="text-accent underline underline-offset-4">
          Back to the tools
        </Link>
      </p>
    </article>
  );
}
