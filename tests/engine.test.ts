// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { applyPatch } from "../src/core/engine";
import civicPatchJson from "../src/registry/patches/civic-apply.openpatch.json";
import type { OpenPatch } from "../src/core/types";

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
    expect(document.getElementById("progress-steps")?.getAttribute("role")).toBe("tablist");
  });

  it("saves and restores unfinished form progress locally", () => {
    applyPatch(civicPatchJson as OpenPatch);
    const name = document.getElementById("full-name") as HTMLInputElement;
    name.value = "Alex Morgan";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    const saved = [...Object.keys(localStorage)].map((key) => localStorage.getItem(key)).join(" ");
    expect(saved).toContain("Alex Morgan");
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
