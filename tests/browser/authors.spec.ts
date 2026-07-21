import { expect, test } from "@playwright/test";
import { encodeRepairRequestHandoff } from "../../src/core/request-handoff";

test("ordinary users can create a testable privacy-safe repair request", async ({ page }, testInfo) => {
  let submittedBody = "";
  await page.route("**/api/repair-requests", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ directSubmission: true }) });
    submittedBody = route.request().postData() ?? "";
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "submitted", number: 41, url: "https://github.com/abbasaliii/patch-the-web/issues/41" }) });
  });
  await page.goto("/authors/");
  await page.getByLabel("Which public page needs repair?").fill("https://example.edu/programs?student=private#results");
  await page.getByLabel("What is making the page difficult?").fill("I only want to see programs offered in Karachi, but the table makes me scan every campus.");
  await page.getByText("Find or filter content", { exact: true }).click();
  await page.getByText("Work properly on mobile", { exact: true }).click();
  await page.getByText("Improve accessibility", { exact: true }).click();
  await page.getByRole("button", { name: "Create my repair request" }).click();

  await expect(page.getByRole("heading", { name: "Your repair request is ready." })).toBeFocused();
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
  const githubLink = page.getByRole("link", { name: "Use GitHub instead" });
  const directSubmit = page.getByRole("button", { name: "Submit request — no account needed" });
  await expect(githubLink).toHaveAttribute("aria-disabled", "true");
  await expect(githubLink).not.toHaveAttribute("href", /.+/);
  await expect(directSubmit).toBeDisabled();
  await page.getByLabel("I reviewed this public text.").check();
  await expect(githubLink).toHaveAttribute("href", /^https:\/\/github\.com\/abbasaliii\/patch-the-web\/issues\/new\?/);
  await expect(directSubmit).toBeEnabled();
  const publicIssue = new URL(await githubLink.getAttribute("href") ?? "");
  expect(publicIssue.searchParams.get("body")).not.toContain("student=private");
  await directSubmit.click();
  await expect(page.getByRole("heading", { name: "Request #41 entered the review queue." })).toBeFocused();
  await expect(page.getByRole("link", { name: /View the public request/ })).toHaveAttribute("href", "https://github.com/abbasaliii/patch-the-web/issues/41");
  expect(submittedBody).not.toContain("student=private");
  expect(JSON.parse(submittedBody)).toMatchObject({ consent: true, request: { publicScope: "https://example.edu/programs", needs: ["filter", "mobile", "accessibility"] } });
  await page.getByRole("button", { name: "Close public submission review" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByText("Build it yourself with Codex", { exact: false }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .md" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("patch-the-web-repair-brief.md");
  if (testInfo.project.name === "mobile-chromium") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  }
});

test("the reviewed GitHub path remains clear when direct submission is unavailable", async ({ page }) => {
  await page.route("**/api/repair-requests", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ directSubmission: false }) }));
  await page.goto("/authors/");
  await page.getByLabel("Which public page needs repair?").fill("https://example.edu/apply");
  await page.getByLabel("What is making the page difficult?").fill("The public application form loses progress after every accidental reload.");
  await page.getByText("Remember unfinished progress", { exact: true }).click();
  await page.getByRole("button", { name: "Create my repair request" }).click();
  await page.getByRole("button", { name: "Review public submission" }).click();
  await expect(page.getByRole("button", { name: "Submit request — no account needed" })).toBeHidden();
  await expect(page.locator("#submission-note")).toContainText("Direct submission is not active");
  await page.getByLabel("I reviewed this public text.").check();
  await expect(page.getByRole("link", { name: "Continue with GitHub" })).toHaveAttribute("href", /^https:\/\/github\.com\/abbasaliii\/patch-the-web\/issues\/new\?/);
});

test("the extension privately prefills a request without sending the handoff to the server", async ({ page }) => {
  const handoff = encodeRepairRequestHandoff({
    target: "https://example.edu/programs?private=value#results",
    complaint: "I only want to see Karachi programs and the table overflows on mobile.",
    needs: ["filter", "mobile", "accessibility"]
  });
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`/authors/#${handoff}`);

  await expect(page.getByLabel("Which public page needs repair?")).toHaveValue("https://example.edu/programs");
  await expect(page.getByLabel("What is making the page difficult?")).toHaveValue("I only want to see Karachi programs and the table overflows on mobile.");
  await expect(page.locator("input[name='needs'][value='filter']")).toBeChecked();
  await expect(page.locator("input[name='needs'][value='mobile']")).toBeChecked();
  await expect(page.locator("input[name='needs'][value='accessibility']")).toBeChecked();
  await expect(page.locator("#form-status")).toContainText("Prefilled privately from the extension");
  expect(new URL(page.url()).hash).toBe("");
  expect(requests.every((url) => !url.includes("Karachi") && !url.includes("private=value") && !url.includes("repair="))).toBe(true);

  await page.getByRole("button", { name: "Create my repair request" }).click();
  await expect(page.getByRole("heading", { name: "Your repair request is ready." })).toBeFocused();
  await expect(page.locator("#scope")).toHaveText("Scope locked to https://example.edu/programs · 3 testable outcomes");
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
