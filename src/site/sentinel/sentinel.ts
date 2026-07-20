type PatchReport = {
  id: string;
  version: string;
  pageUrl: string;
  status: "healthy" | "drifted" | "unreachable";
  checkedAt: string;
  healthy: number;
  total: number;
  fingerprint: string;
  results: Array<{ id: string; matched: number; healthy: boolean }>;
};

type CompatibilityReport = {
  generatedAt: string;
  summary: { healthy: number; drifted: number; unreachable: number; total: number };
  patches: PatchReport[];
};

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function displayName(id: string) {
  if (id.includes("metrocare")) return "MetroCare: personal service navigator";
  if (id.includes("civicapply")) return "CivicApply: accessible & autosaved";
  return id;
}

function renderPatch(patch: PatchReport) {
  const article = document.createElement("article");
  article.className = `patch-row ${patch.status}`;

  const head = document.createElement("div");
  head.className = "patch-row__head";
  const title = document.createElement("div");
  title.innerHTML = `<span class="patch-status" aria-hidden="true">${patch.status === "healthy" ? "✓" : "!"}</span>`;
  const copy = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = displayName(patch.id);
  const target = document.createElement("a");
  target.href = patch.pageUrl;
  target.textContent = new URL(patch.pageUrl).pathname;
  copy.append(heading, target);
  title.append(copy);
  const score = document.createElement("span");
  score.className = "patch-score";
  score.textContent = `${patch.healthy}/${patch.total} live`;
  head.append(title, score);

  const metadata = document.createElement("dl");
  const entries = [
    ["Version", `v${patch.version}`],
    ["Target", new URL(patch.pageUrl).hostname],
    ["Fingerprint", `${patch.fingerprint.slice(0, 16)}…`]
  ];
  for (const [label, value] of entries) {
    const group = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    group.append(term, detail);
    metadata.append(group);
  }

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = `Inspect ${patch.total} operation targets`;
  const operations = document.createElement("div");
  operations.className = "operation-grid";
  for (const result of patch.results) {
    const row = document.createElement("span");
    row.className = result.healthy ? "" : "failed";
    row.textContent = `${result.healthy ? "✓" : "✗"} ${result.id} · ${result.matched}`;
    operations.append(row);
  }
  details.append(summary, operations);
  article.append(head, metadata, details);
  return article;
}

async function loadCompatibility() {
  const response = await fetch("/registry/compatibility.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Compatibility receipt returned ${response.status}`);
  const report = await response.json() as CompatibilityReport;
  byId("metric-total").textContent = String(report.summary.total);
  byId("metric-healthy").textContent = `${report.summary.healthy}/${report.summary.total}`;
  byId("metric-operations").textContent = String(report.patches.reduce((total, patch) => total + patch.total, 0));
  byId("hero-status").textContent = report.summary.healthy === report.summary.total
    ? `All ${report.summary.total} patches compatible`
    : `${report.summary.drifted + report.summary.unreachable} patches quarantined`;
  byId("hero-checked").textContent = `Last checked ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.generatedAt))}`;
  byId("patch-list").replaceChildren(...report.patches.map(renderPatch));
}

byId<HTMLButtonElement>("simulate-drift").addEventListener("click", (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  const state = byId("simulation-state");
  const active = state.classList.toggle("quarantined");
  state.querySelector(".state-icon")!.textContent = active ? "!" : "✓";
  state.querySelector("strong")!.textContent = active ? "Quarantined from discovery" : "Eligible for discovery";
  state.querySelector("small")!.textContent = active ? "9/10 operations · directory target drifted" : "10/10 operations compatible";
  button.textContent = active ? "Restore healthy simulation" : "Simulate selector drift";
  byId("simulation-note").textContent = active
    ? "Discovery blocks this patch until a maintainer publishes and verifies an updated version."
    : "The real published patch remains untouched.";
});

void loadCompatibility().catch((error) => {
  byId("hero-status").textContent = "Receipt unavailable";
  byId("hero-checked").textContent = error instanceof Error ? error.message : "Unknown registry error";
  byId("patch-list").textContent = "Compatibility evidence could not be loaded.";
});
