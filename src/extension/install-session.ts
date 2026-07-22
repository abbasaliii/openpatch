export type InstallCandidateSource = "local-file" | "public-registry";

export type InstallSession = {
  raw: string;
  hash: string;
  source: InstallCandidateSource;
  tabId: number;
  tabUrl: string;
  createdAt: number;
};

export const INSTALL_SESSION_KEY = "installWizardSession";
export const INSTALL_SESSION_TTL_MS = 15 * 60_000;

export function isInstallSession(value: unknown, now = Date.now()): value is InstallSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<InstallSession>;
  return typeof candidate.raw === "string"
    && new TextEncoder().encode(candidate.raw).byteLength > 0
    && new TextEncoder().encode(candidate.raw).byteLength <= 256_000
    && typeof candidate.hash === "string"
    && /^[a-f0-9]{64}$/i.test(candidate.hash)
    && (candidate.source === "local-file" || candidate.source === "public-registry")
    && Number.isInteger(candidate.tabId)
    && (candidate.tabId ?? -1) >= 0
    && typeof candidate.tabUrl === "string"
    && /^https?:\/\//.test(candidate.tabUrl)
    && Number.isFinite(candidate.createdAt)
    && (candidate.createdAt ?? 0) <= now
    && now - (candidate.createdAt ?? 0) <= INSTALL_SESSION_TTL_MS;
}
