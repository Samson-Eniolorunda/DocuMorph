// Site-wide settings that come from the environment. Public names are read statically so Next can inline them.

/** An address that must be a web address, or nothing: a mistyped setting hides the link rather than breaking a page. */
function webUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const siteUrl = webUrl(process.env.NEXT_PUBLIC_SITE_URL);
// next.config.ts stops a production build without it; in development the local address is used.

export const SITE = {
  name: "DocuMorph",
  url: (siteUrl ?? "http://localhost:3000").replace(/\/$/, ""),
  tagline: "Private PDF and image tools that run in your browser.",
  owner: "Samson Eniolorunda",
  /** The owner's portfolio. The credit is not a link when this is unset. */
  portfolioUrl: webUrl(process.env.NEXT_PUBLIC_PORTFOLIO_URL),
  /** Buy Me a Coffee page. Every coffee link is hidden when this is unset. */
  coffeeUrl: webUrl(process.env.NEXT_PUBLIC_BUYMEACOFFEE_URL),
};
