/** Turns any thrown value into a sentence people can act on. */
export function explain(err: unknown, fallback = "Something went wrong. Please try again.") {
  const msg = err instanceof Error ? err.message : "";
  if (/encrypt|password/i.test(msg))
    return "This PDF is password-protected. Remove the password first, then try again.";
  if (/Invalid PDF|No PDF header|Failed to parse/i.test(msg))
    return "This file could not be read as a PDF. It may be damaged.";
  return msg || fallback;
}
