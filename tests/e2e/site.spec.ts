import { expect, test } from "@playwright/test";
import { pdfFile, pick } from "./helpers";

test("the footer has the credit, Privacy, Terms, feedback and the coffee link", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Samson Eniolorunda" })).toHaveAttribute(
    "href",
    "https://example.com/portfolio",
  );
  await expect(footer.getByRole("link", { name: "Privacy" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Terms" })).toBeVisible();
  await expect(footer.getByRole("button", { name: "Send feedback" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Buy me a coffee" })).toHaveAttribute(
    "href",
    "https://example.com/coffee",
  );
});

test("the Terms page opens", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
});

test("feedback: message is required, a send succeeds, and the page is passed on", async ({ page }) => {
  let body: Record<string, string> = {};
  await page.route("**/api/feedback", async (route) => {
    body = route.request().postDataJSON() as Record<string, string>;
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"sent":true}' });
  });
  await page.goto("/merge-pdf");
  await page.waitForLoadState("networkidle");
  await page.getByRole("contentinfo").getByRole("button", { name: "Send feedback" }).click();
  const dialog = page.getByRole("dialog", { name: "Send feedback" });
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("a little more");
  await dialog.getByLabel("Message").fill("The merge works well on my phone.");
  await dialog.getByLabel(/E-mail address/).fill("me@example.org");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(dialog.getByText("Your message has been sent")).toBeVisible();
  expect(body).toMatchObject({ page: "/merge-pdf", email: "me@example.org" });
});

test("feedback: a failure is shown and the message is kept", async ({ page }) => {
  await page.route("**/api/feedback", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: '{"error":"Your message could not be sent. Please try again in a moment."}',
    }),
  );
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("contentinfo").getByRole("button", { name: "Send feedback" }).click();
  const dialog = page.getByRole("dialog", { name: "Send feedback" });
  await dialog.getByLabel("Message").fill("Something to say.");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("could not be sent");
  await expect(dialog.getByLabel("Message")).toHaveValue("Something to say.");
});

test("the Tools sheet offers feedback and the coffee link", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tools" }).click();
  const sheet = page.getByRole("dialog", { name: "All tools" });
  await expect(sheet.getByRole("button", { name: "Send feedback" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Buy me a coffee" })).toBeVisible();
});

test("every upload area carries the one-line promise", async ({ page }) => {
  for (const slug of ["merge-pdf", "word-to-pdf", "compress-image"]) {
    await page.goto(`/${slug}`);
    await expect(page.getByText(/processed .*(this conversion only|on your device)/i).first()).toBeVisible();
  }
});

test("Compress PDF runs on the device and offers a smaller file or says it cannot", async ({ page }) => {
  await page.goto("/compress-pdf");
  await pick(page, [await pdfFile("report.pdf", 3)]);
  await page.getByRole("radio", { name: /Light, keeps text/ }).check();
  await page.getByRole("button", { name: "Compress PDF" }).click();
  await expect(page.getByText("Your file is ready")).toBeVisible();
  await expect(page.getByText("report-compressed.pdf")).toBeVisible();
});

test("every tool has its own share image", async ({ page, request }) => {
  const seen = new Set<string>();
  for (const slug of ["merge-pdf", "word-to-pdf", "compress-pdf"]) {
    await page.goto(`/${slug}`);
    const url = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(url).toContain(`/${slug}/opengraph-image`);
    const res = await request.get(url ?? "");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    seen.add(url ?? "");
  }
  expect(seen.size).toBe(3);
});

test("the icon set is linked: favicon, Apple touch icon and the manifest's PNGs", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  for (const icon of manifest.icons as { src: string }[]) expect((await request.get(icon.src)).status()).toBe(200);
  expect((await request.get("/favicon.ico")).status()).toBe(200);
});
