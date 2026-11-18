import type { NextConfig } from "next";

// Security headers for every page. Files never need third-party scripts:
// pdf.js and its worker are served from this site.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// The site's address comes only from NEXT_PUBLIC_SITE_URL. A production build without it would publish
// wrong canonical links and share images, so it stops here.
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
  throw new Error(
    "NEXT_PUBLIC_SITE_URL is required for a production build (for example https://your-project.vercel.app).",
  );
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
