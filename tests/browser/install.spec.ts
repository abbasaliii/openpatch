import { expect, test } from "@playwright/test";

test("a nontechnical user gets a complete installation and first-repair path", async ({ page }, testInfo) => {
  await page.goto("/install/");
  await expect(page.getByRole("heading", { name: "Install the beta extension" })).toBeVisible();
  await expect(page.locator("#progress")).toHaveText("0 of 4 steps marked complete");
  await expect(page.getByRole("link", { name: /Download v0.9.1/ })).toHaveAttribute("href", "/downloads/patch-the-web-extension-v0.9.1.zip");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: /Download v0.9.1/ }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("patch-the-web-extension-v0.9.1.zip");
  await expect(page.locator("#progress")).toHaveText("1 of 4 steps marked complete");

  await page.getByLabel(/Open Chrome’s Extensions page/).check();
  await page.getByLabel(/Choose “Load unpacked”/).check();
  await page.getByLabel(/Pin Patch the Web/).check();
  await expect(page.locator("#progress")).toHaveText("Ready to try your first repair ✓");

  await page.reload();
  await expect(page.locator("#progress")).toHaveText("Ready to try your first repair ✓");
  await expect(page.getByRole("link", { name: /Open the repair demo/ })).toHaveAttribute("href", "/care/");
  await expect(page.getByText("Select the folder containing")).toBeHidden();
  await page.getByText("I selected a folder and Chrome rejected it").click();
  await expect(page.getByText("Select the folder containing")).toBeVisible();

  if (testInfo.project.name === "mobile-chromium") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  }
});
