// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyPatch } from "../src/core/engine";
import civicPatchJson from "../src/registry/patches/civic-apply.openpatch.json";
import metroCarePatchJson from "../src/registry/patches/metrocare-service-navigator.openpatch.json";
import type { OpenPatch } from "../src/core/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fixture = `
  <div class="survey-wall">Survey</div>
  <span class="draft-badge">Not saved</span>
  <div id="progress-steps"><button>One</button><button>Two</button><button>Three</button></div>
  <div class="application-shell">
    <main class="application-main">
      <form id="benefits-form">
        <div class="field-row"><input id="full-name" name="fullName"></div>
        <div class="field-row"><input id="email" name="email"></div>
        <div class="field-row"><input id="phone" name="phone"></div>
        <div class="field-row"><select id="household-size" name="householdSize"><option value="">Choose</option><option value="2">Two</option></select></div>
        <div class="field-row"><textarea id="address" name="address"></textarea></div>
        <button type="submit">Continue</button>
      </form>
    </main>
    <aside class="application-sidebar"><section class="help-card">Help</section></aside>
  </div>
`;

describe("constrained patch runtime", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-openpatch-applied");
    document.documentElement.className = "";
    document.body.innerHTML = fixture;
    localStorage.clear();
  });

  it("applies all bundled operations without executing patch code", () => {
    const health = applyPatch(civicPatchJson as OpenPatch);
    expect(health.applied).toBe(true);
    expect(health.healthy).toBe(health.total);
    expect((document.querySelector(".survey-wall") as HTMLElement).hidden).toBe(true);
    expect(document.querySelector(".application-main > .help-card")).not.toBeNull();
    expect(document.getElementById("progress-steps")?.getAttribute("role")).toBe("group");
  });

  it("saves and restores unfinished form progress locally", () => {
    applyPatch(civicPatchJson as OpenPatch);
    const name = document.getElementById("full-name") as HTMLInputElement;
    name.value = "Alex Morgan";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    const saved = [...Object.keys(localStorage)].map((key) => localStorage.getItem(key)).join(" ");
    expect(saved).toContain("Alex Morgan");
  });

  it("expires locally stored drafts after the declared retention window", () => {
    const now = 1_800_000_000_000;
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(now);
    applyPatch(civicPatchJson as OpenPatch);
    const name = document.getElementById("full-name") as HTMLInputElement;
    name.value = "Alex Morgan";
    name.dispatchEvent(new Event("input", { bubbles: true }));

    document.documentElement.removeAttribute("data-openpatch-applied");
    document.documentElement.className = "";
    document.body.innerHTML = fixture;
    dateNow.mockReturnValue(now + (24 * 60 + 1) * 60_000);
    applyPatch(civicPatchJson as OpenPatch);

    expect((document.getElementById("full-name") as HTMLInputElement).value).toBe("");
    expect(document.querySelector(".openpatch-save-status")?.textContent).toContain("expired");
  });

  it("adds specific accessible validation messages", () => {
    applyPatch(civicPatchJson as OpenPatch);
    const form = document.getElementById("benefits-form") as HTMLFormElement;
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    const email = document.getElementById("email") as HTMLInputElement;
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(email.getAttribute("aria-describedby") ?? "")?.textContent).toContain("email address");
  });

  it("adds arrow-key navigation to progress controls", () => {
    applyPatch(civicPatchJson as OpenPatch);
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("#progress-steps button")];
    buttons[0].focus();
    buttons[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons[1].tabIndex).toBe(0);
  });
});

const careFixture = readFileSync(resolve(import.meta.dirname, "../src/site/care/index.html"), "utf8");

describe("safe collection navigator runtime", () => {
  beforeEach(() => {
    const parsed = new DOMParser().parseFromString(careFixture, "text/html");
    document.documentElement.removeAttribute("data-openpatch-applied");
    document.documentElement.className = "";
    document.head.innerHTML = parsed.head.innerHTML;
    document.body.innerHTML = parsed.body.innerHTML;
    localStorage.clear();
  });

  it("adds accessible search and facets without patch-authored HTML or script", () => {
    const health = applyPatch(metroCarePatchJson as OpenPatch);
    expect(health.applied).toBe(true);
    expect(health.healthy).toBe(11);
    expect(document.querySelectorAll(".openpatch-navigator input[type='search']")).toHaveLength(1);
    expect(document.querySelectorAll(".openpatch-navigator select")).toHaveLength(4);
    expect(document.querySelector(".openpatch-navigator__status")?.getAttribute("aria-live")).toBe("polite");
    expect(document.querySelectorAll(".openpatch-compare__select")).toHaveLength(12);
  });

  it("combines real access needs into one matching service", () => {
    applyPatch(metroCarePatchJson as OpenPatch);
    const select = (id: string, value: string) => {
      const element = document.querySelector<HTMLSelectElement>(`select[id$='-${id}']`)!;
      element.value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    };
    select("access", "wheelchair");
    select("language", "urdu");
    select("availability", "new-patients");
    const visible = [...document.querySelectorAll<HTMLElement>(".care-service")].filter((item) => !item.hidden);
    expect(visible).toHaveLength(1);
    expect(visible[0].dataset.serviceName).toBe("Harbor Family Clinic");
    expect(document.querySelector(".openpatch-navigator__status")?.textContent).toBe("1 of 12 services match");
  });

  it("keeps access preferences local and restores them within the TTL", () => {
    applyPatch(metroCarePatchJson as OpenPatch);
    const language = document.querySelector<HTMLSelectElement>("select[id$='-language']")!;
    language.value = "urdu";
    language.dispatchEvent(new Event("change", { bubbles: true }));
    expect([...Object.values(localStorage)].join(" ")).toContain("urdu");

    const parsed = new DOMParser().parseFromString(careFixture, "text/html");
    document.documentElement.removeAttribute("data-openpatch-applied");
    document.documentElement.className = "";
    document.body.innerHTML = parsed.body.innerHTML;
    applyPatch(metroCarePatchJson as OpenPatch);
    expect(document.querySelector<HTMLSelectElement>("select[id$='-language']")?.value).toBe("urdu");
  });

  it("supports slash-to-search and Escape-to-clear", () => {
    applyPatch(metroCarePatchJson as OpenPatch);
    const search = document.querySelector<HTMLInputElement>(".openpatch-navigator input[type='search']")!;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(search);
    search.value = "therapy";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    search.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(search.value).toBe("");
    expect(document.querySelector(".openpatch-navigator__status")?.textContent).toBe("12 of 12 services match");
  });

  it("builds a keyboard-accessible comparison table from declared data attributes", () => {
    applyPatch(metroCarePatchJson as OpenPatch);
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".openpatch-compare__select")];
    buttons[0].click();
    buttons[2].click();
    buttons[1].click();
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[3].disabled).toBe(true);
    expect(document.querySelector(".openpatch-compare__status")?.getAttribute("aria-live")).toBe("polite");
    expect(document.querySelector(".openpatch-compare__status")?.textContent).toContain("3 items selected");

    document.querySelector<HTMLButtonElement>(".openpatch-compare__action:not(.secondary)")?.click();
    const table = document.querySelector(".openpatch-compare table");
    expect(table).not.toBeNull();
    expect(table?.textContent).toContain("Harbor Family Clinic");
    expect(table?.textContent).toContain("Northside Community Health");
    expect(table?.textContent).toContain("Wheelchair access");
    expect(table?.textContent).toContain("Urdu");
    expect(table?.textContent).toContain("Spanish");
    expect(table?.querySelector("thead th")?.getAttribute("scope")).toBe("col");
    expect(table?.querySelector("tbody th")?.getAttribute("scope")).toBe("row");
    expect(table?.getAttribute("aria-labelledby")).toBe(document.querySelector(".openpatch-compare__result h3")?.id);
    expect(table?.getAttribute("aria-describedby")).toBe(document.querySelector(".openpatch-compare__result p")?.id);
  });
});
