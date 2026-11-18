import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms",
  alternates: { canonical: "/terms" },
  description: "The terms on which DocuMorph is offered: what it is for, what it does with your files, and its limits.",
};

const H2 = "mt-8 text-title font-semibold";
const P = "mt-2 text-muted";

export default function Terms() {
  return (
    <article className="mx-auto max-w-[68ch] px-4 pb-12 pt-6 sm:px-6 sm:pt-10">
      <h1 className="text-display font-semibold tracking-[-0.01em] md:text-display-lg">Terms</h1>
      <p className="mt-2 text-muted">The terms on which DocuMorph is offered.</p>
      <p className="mt-1 text-body-sm text-subtle">Last updated 18 November 2026.</p>

      <h2 className="mt-8 text-title font-semibold">Using DocuMorph</h2>
      <p className={P}>
        DocuMorph is a free service for everyday document and image tasks. By using it you agree to these terms. You may
        use it for lawful purposes only, and only with files that you have the right to use.
      </p>

      <h2 className={H2}>Your files</h2>
      <p className={P}>
        You keep every right you have in your files. Tools that run on your device never upload them. For the tools
        marked Server, a file is sent for that one conversion, processed, returned to you and deleted straight after;
        DocuMorph does not keep a copy. The{" "}
        <Link href="/privacy" className="text-accent underline underline-offset-4">
          Privacy
        </Link>{" "}
        page explains this in full.
      </p>

      <h2 className={H2}>Fair use and limits</h2>
      <p className={P}>
        To keep the service free for everyone, server conversions are limited in size (4 MB) and in number per visitor
        per day, and PDF to Word and PDF to Excel share a limited daily and monthly allowance. Please do not try to
        bypass these limits, overload the service, or use it to send harmful files.
      </p>

      <h2 className={H2}>No guarantee</h2>
      <p className={P}>
        DocuMorph is provided as it is, without a promise that it will always be available, error-free or suitable for a
        particular purpose. Conversions can change fonts, layout or formatting, and some documents cannot be converted
        at all. Check the result before you rely on it, and keep your original. To the extent the law allows, the owner
        is not liable for loss arising from the use of the service.
      </p>

      <h2 className={H2}>Ownership</h2>
      <p className={P}>
        The DocuMorph name, design and code belong to {SITE.owner}. All rights are reserved. The service uses
        third-party components under their own licences.
      </p>

      <h2 className={H2}>Changes and contact</h2>
      <p className={P}>
        These terms may be updated; the date above shows the latest version. Questions and comments are welcome through
        the Send feedback link in the footer.
      </p>

      <p className="mt-10">
        <Link href="/" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">
          Back to the tools
        </Link>
      </p>
    </article>
  );
}
