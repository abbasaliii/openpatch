import { expect, test } from "@playwright/test";

test("ordinary users can create a testable privacy-safe repair request", async ({ page }, testInfo) => {
  await page.goto("/authors/");
  await page.getByLabel("Which public page needs repair?").fill("https://example.edu/programs?student=private#results");
  await page.getByLabel("What is making the page difficult?").fill("I only want to see programs offered in Karachi, but the table makes me scan every campus.");
  await page.getByText("Find or filter content", { exact: true }).click();
  await page.getByText("Work properly on mobile", { exact: true }).click();
  await page.getByText("Improve accessibility", { exact: true }).click();
  await page.getByRole("button", { name: "Create my repair request" }).click();

  await expect(page.getByRole("heading", { name: "Paste this into Codex." })).toBeFocused();
  await expect(page.locator("#scope")).toHaveText("Scope locked to https://example.edu/programs · 3 testable outcomes");
  await expect(page.locator("#preview")).toContainText("Use $patch-the-web-author");
  await expect(page.locator("#preview")).toContainText("390px viewport");
  await expect(page.locator("#preview")).not.toContainText("student=private");
  await expect(page.locator("#preview")).not.toContainText("#results");

  await page.getByRole("button", { name: "Review public submission" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review before anything leaves this browser." })).toBeFocused();
  await expect(page.locator("#share-preview")).toContainText("## Public page");
  await expect(page.locator("#share-preview")).toContainText("https://example.edu/programs");
  await expect(page.locator("#share-preview")).not.toContainText("student=private");
  const githubLink = page.getByRole("link", { name: "Open public GitHub request" });
  await expect(githubLink).toHaveAttribute("aria-disabled", "true");
  await expect(githubLink).not.toHaveAttribute("href", /.+/);
  await page.getByLabel("I reviewed this public text.").check();
  await expect(githubLink).toHaveAttribute("href", /^https:\/\/github\.com\/abbasaliii\/patch-the-web\/issues\/new\?/);
  const publicIssue = new URL(await githubLink.getAttribute("href") ?? "");
  expect(publicIssue.searchParams.get("body")).not.toContain("student=private");
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .md" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("patch-the-web-repair-brief.md");
  if (testInfo.project.name === "mobile-chromium") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  }
});

test("the guided request restores an unfinished tab-local draft and explains missing choices", async ({ page }) => {
  await page.goto("/authors/");
  await page.getByLabel("Which public page needs repair?").fill("https://example.edu/apply");
  await page.getByLabel("What is making the page difficult?").fill("The application loses all of my progress after an accidental refresh.");
  await page.reload();
  await expect(page.getByLabel("Which public page needs repair?")).toHaveValue("https://example.edu/apply");
  await expect(page.getByLabel("What is making the page difficult?")).toHaveValue("The application loses all of my progress after an accidental refresh.");
  await expect(page.locator("#form-status")).toContainText("restored in this browser tab");

  await page.getByRole("button", { name: "Create my repair request" }).click();
  await expect(page.locator("#form-status")).toHaveText("Choose at least one result you want from the repair.");
  await page.getByText("Remember unfinished progress", { exact: true }).click();
  await page.getByRole("button", { name: "Create my repair request" }).click();
  await expect(page.locator("#preview")).toContainText("restored locally after reload");
});
