// Size budgets for what a phone downloads. Run after a build: node scripts/budgets.mjs
// It starts the production server, reads each page's scripts and styles, and compares their gzip size with budgets.json.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const budgets = JSON.parse(readFileSync(new URL("../budgets.json", import.meta.url), "utf8"));
const PORT = 3290;
const base = `http://127.0.0.1:${PORT}`;
const server = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "ignore" });
const stop = () => server.kill();
process.on("exit", stop);

async function up() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {
      // not yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("The server did not start.");
}

const gz = async (url) => gzipSync(Buffer.from(await (await fetch(new URL(url, base))).arrayBuffer())).length;

let failed = false;
try {
  await up();
  for (const [path, limit] of Object.entries(budgets.pages)) {
    const html = await (await fetch(base + path)).text();
    const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
    const styles = [...new Set([...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]))];
    const js = (await Promise.all(scripts.map(gz))).reduce((a, b) => a + b, 0);
    const css = (await Promise.all(styles.map(gz))).reduce((a, b) => a + b, 0);
    const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
    const bad = js > limit.jsKb * 1024 || css > limit.cssKb * 1024;
    failed ||= bad;
    console.log(
      `${bad ? "FAIL" : "ok  "} ${path.padEnd(14)} script ${kb(js)} of ${limit.jsKb} KB, styles ${kb(css)} of ${limit.cssKb} KB`,
    );
  }
} finally {
  stop();
}
if (failed) {
  console.error("A page is over its size budget. Reduce it, or raise the budget in budgets.json with a reason.");
  process.exit(1);
}
