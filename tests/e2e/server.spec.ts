import { expect, test } from "@playwright/test";
import { pick } from "./helpers";

const DOCX = {
  name: "letter.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]),
};

test("a server tool states where the file goes before a file is chosen", async ({ page }) => {
  await page.goto("/word-to-pdf");
  await expect(page.getByText(/Sent to ConvertAPI/)).toBeVisible();
  await expect(page.getByText(/up to 4 MB/).first()).toBeVisible();
});

test("converts, fetches the file from this site, and tells the visitor what is left", async ({ page }) => {
  await page.route("**/api/convert", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "letter.pdf",
        size: 8,
        fileId: "abcdef1234567890",
        token: "tokentokentokentoken",
        remaining: 7,
      }),
    }),
  );
  await page.route("**/api/convert/result?**", (route) =>
    route.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.4" }),
  );
  await page.goto("/word-to-pdf");
  await pick(page, [DOCX]);
  await page.getByRole("button", { name: "Word to PDF" }).click();
  await expect(page.getByText("Your file is ready")).toBeVisible();
  await expect(page.getByText("letter.pdf")).toBeVisible();
  await expect(page.getByText(/deleted from ConvertAPI/)).toBeVisible();
  await expect(page.getByText("7")).toBeVisible();
});

test("shows the server's reason when the limit is reached, and keeps the file", async ({ page }) => {
  await page.route("**/api/convert", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ error: "You have used today's 10 server conversions. Please try again tomorrow." }),
    }),
  );
  await page.goto("/word-to-pdf");
  await pick(page, [DOCX]);
  await page.getByRole("button", { name: "Word to PDF" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("try again tomorrow");
  await expect(page.getByText("letter.docx")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("a file of the wrong type or over 4 MB is refused on the device", async ({ page }) => {
  await page.goto("/word-to-pdf");
  await pick(page, [{ name: "x.docx", mimeType: "text/plain", buffer: Buffer.from("plain text") }]);
  await expect(page.locator("main").getByRole("alert")).toContainText("not a .docx or .doc file");
  await pick(page, [
    {
      name: "big.docx",
      mimeType: DOCX.mimeType,
      buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(4 * 1024 * 1024 + 10)]),
    },
  ]);
  await expect(page.locator("main").getByRole("alert")).toContainText("limit here is 4 MB");
});

test("losing the connection keeps the file and says so", async ({ page }) => {
  await page.route("**/api/convert", (route) => route.abort("internetdisconnected"));
  await page.goto("/word-to-pdf");
  await pick(page, [DOCX]);
  await page.getByRole("button", { name: "Word to PDF" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(/Your file is still here/);
  await expect(page.getByText("letter.docx")).toBeVisible();
});

test("a conversion can be cancelled", async ({ page }) => {
  await page.route("**/api/convert", () => undefined);
  await page.goto("/word-to-pdf");
  await pick(page, [DOCX]);
  await page.getByRole("button", { name: "Word to PDF" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Word to PDF" })).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});
