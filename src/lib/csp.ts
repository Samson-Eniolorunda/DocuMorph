// The Content-Security-Policy. Scripts run only with this request's nonce (and what such a script loads);
// nothing from another site is allowed, because every library and font is served from this one.

export function newNonce() {
  return btoa(crypto.randomUUID());
}

export function contentSecurityPolicy(nonce: string, dev = false) {
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval' lets pdf.js run its WebAssembly decoders; it does not allow eval of text.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Style attributes (sizes of page previews and the editor's boxes) are set by the page's own code.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
