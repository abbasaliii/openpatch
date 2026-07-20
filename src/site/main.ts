const observe = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("revealed");
  });
}, { threshold: 0.12 });

document.querySelectorAll(".section, .proof-bar, .impact-band").forEach((element) => observe.observe(element));

type RegistryIndex = {
  patches: Array<{
    id: string;
    version: string;
    sha256: string;
    scope: { hosts: string[]; paths: string[] };
    verification: { status: string; operations: number; assertions: number };
    compatibility?: {
      status: "healthy" | "drifted" | "unreachable";
      checkedAt: string;
      healthy: number;
      total: number;
      fingerprint: string;
    };
  }>;
};

async function loadRegistryReceipt() {
  try {
    const response = await fetch("/registry/index.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Registry returned ${response.status}`);
    const index = await response.json() as RegistryIndex;
    const patch = index.patches.find((entry) => entry.id === "org.openpatch.metrocare-service-navigator");
    if (!patch) throw new Error("Flagship patch is missing");
    const version = document.getElementById("registry-version");
    const health = document.getElementById("registry-health");
    const scope = document.getElementById("registry-scope");
    const receipt = document.getElementById("registry-receipt");
    const compatibility = document.getElementById("compatibility-receipt");
    if (version) version.textContent = `Published v${patch.version}`;
    if (health) health.innerHTML = `<i></i> ${patch.compatibility?.healthy ?? patch.verification.operations}/${patch.compatibility?.total ?? patch.verification.operations} live`;
    if (scope) scope.textContent = `${patch.scope.hosts.join(", ")} · ${patch.scope.paths.join(", ")}`;
    if (receipt) receipt.textContent = `SHA-256 ${patch.sha256} · ${patch.verification.assertions} assertions`;
    if (compatibility && patch.compatibility) {
      const checked = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(patch.compatibility.checkedAt));
      compatibility.textContent = `Compatibility Sentinel: ${patch.compatibility.status} · checked ${checked} · ${patch.compatibility.fingerprint.slice(0, 12)}…`;
    }
  } catch {
    const receipt = document.getElementById("registry-receipt");
    if (receipt) receipt.textContent = "Registry receipt unavailable — bundled demo remains usable.";
  }
}

void loadRegistryReceipt();
