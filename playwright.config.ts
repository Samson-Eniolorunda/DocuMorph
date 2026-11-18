import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PW_CHROMIUM_PATH;
const launchOptions = executablePath ? { executablePath, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "off" },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
    timeout: 240_000,
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, launchOptions } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 }, launchOptions } },
  ],
});
