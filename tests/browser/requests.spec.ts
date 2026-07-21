import { expect, test, type Page } from "@playwright/test";

const sampleRequests = [
  { number: 12, title: "[Repair request] example.edu", body: "<!-- patch-the-web-request:v1 -->\n## Public page\nhttps://example.edu/programs\n\n## Problem\nThe page makes students scan every campus to find Karachi programs.\n## Desired outcomes\n- Filter by Karachi\n## Privacy confirmation", state: "open", html_url: "https://github.com/abbasaliii/patch-the-web/issues/12", created_at: "2026-07-20T10:00:00Z", updated_at: new Date().toISOString(), user: { login: "student-one" }, labels: [{ name: "repair-request" }, { name: "authoring" }] },
  { number: 8, title: "[Repair request] services.example.gov", body: "<!-- patch-the-web-request:v1 -->\n## Public page\nhttps://services.example.gov/directory\n\n## Problem\nThe directory needs an accessible local filter.\n## Desired outcomes\n- Add filtering\n## Privacy confirmation", state: "closed", html_url: "https://github.com/abbasaliii/patch-the-web/issues/8", created_at: "2026-07-18T10:00:00Z", updated_at: new Date().toISOString(), user: { login: "community-member" }, labels: [{ name: "repair-request" }, { name: "published" }] },
  { number: 99, title: "Unsafe response", state: "open", html_url: "javascript:alert(1)", created_at: "2026-07-18T10:00:00Z", updated_at: new Date().toISOString(), labels: [{ name: "repair-request" }] }
];

async function mockQueue(page: Page, body: unknown = sampleRequests, status = 200) {
  await page.route("https://api.github.com/**", (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }));
}

test("people can track a repair from authoring through publication", async ({ page }, testInfo) => {
  await mockQueue(page);
  await page.goto("/requests/");
  await expect(page.getByRole("heading", { name: "Repair requests" })).toBeVisible();
  await expect(page.locator("#open-count")).toHaveText("1");
  await expect(page.locator("#building-count")).toHaveText("1");
  await expect(page.locator("#published-count")).toHaveText("1");
  await expect(page.locator(".request-card")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "example.edu" })).toBeVisible();
  await expect(page.locator(".request-card", { hasText: "example.edu" }).locator(".target")).toHaveText("example.edu/programs");
  await expect(page.locator(".request-card", { hasText: "example.edu" }).locator(".problem")).toContainText("scan every campus");
  await expect(page.locator(".request-card", { hasText: "example.edu" }).locator(".stage-copy")).toHaveText("Stage 3 of 5 · A maintainer is building and testing");
  await expect(page.locator("#request-grid .status", { hasText: "Authoring" })).toBeVisible();
  await expect(page.locator("#request-grid .status", { hasText: "Published" })).toBeVisible();
  await page.getByLabel("Show").selectOption("published");
  await expect(page.locator(".request-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "services.example.gov" })).toBeVisible();
  await expect(page.getByRole("link", { name: /View public repair request 8/ })).toHaveAttribute("href", "https://github.com/abbasaliii/patch-the-web/issues/8");
  if (testInfo.project.name === "mobile-chromium") expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});

test("the queue has useful empty and outage states", async ({ page }) => {
  await mockQueue(page, []);
  await page.goto("/requests/");
  await expect(page.getByRole("heading", { name: "No requests in this view yet." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Request a community repair/ })).toHaveAttribute("href", "/authors/");

  await page.unroute("https://api.github.com/**");
  await mockQueue(page, { message: "rate limited" }, 403);
  await page.reload();
  await expect(page.getByRole("heading", { name: "The public queue could not be loaded." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
