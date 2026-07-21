export const REQUEST_HANDOFF_KEY = "repair";
export const COMMUNITY_REQUEST_URL = "https://patch-the-web.vercel.app/authors/";

export const HANDOFF_NEEDS = ["filter", "mobile", "accessibility", "progress", "keyboard", "obstruction", "simplify"] as const;
export type HandoffNeed = typeof HANDOFF_NEEDS[number];

export type RepairRequestHandoff = {
  version: 1;
  source: "extension";
  target: string;
  complaint: string;
  needs: HandoffNeed[];
};

type HandoffSignals = {
  overflowsHorizontally?: boolean;
  fields?: number;
  unlabeledFields?: number;
  unnamedButtons?: number;
  imagesMissingAlt?: number;
  possibleObstructions?: number;
};

const NEED_PATTERNS: Record<HandoffNeed, RegExp> = {
  filter: /\b(search|filter|find|only show|sort|program|course|product|service|campus|table|list)\b/i,
  mobile: /\b(mobile|phone|small screen|overflow|responsive|zoom|off.?screen)\b/i,
  accessibility: /\b(accessib|screen reader|contrast|label|error message|aria|alt text|blind|low vision)\b/i,
  progress: /\b(progress|save|draft|reload|refresh|lose|losing|unfinished|form)\b/i,
  keyboard: /\b(keyboard|tab key|focus|shortcut|arrow key)\b/i,
  obstruction: /\b(popup|pop-up|overlay|modal|survey|banner|obstruct|cover|blocked)\b/i,
  simplify: /\b(confus|simplif|workflow|too many steps|reorgan|hard to use|difficult to use)\b/i
};

export function inferRepairNeeds(complaint: string, signals: HandoffSignals = {}): HandoffNeed[] {
  const needs = new Set<HandoffNeed>();
  for (const need of HANDOFF_NEEDS) if (NEED_PATTERNS[need].test(complaint)) needs.add(need);
  if (signals.overflowsHorizontally) needs.add("mobile");
  if ((signals.unlabeledFields ?? 0) + (signals.unnamedButtons ?? 0) + (signals.imagesMissingAlt ?? 0) > 0) needs.add("accessibility");
  if ((signals.possibleObstructions ?? 0) > 0) needs.add("obstruction");
  if (needs.size === 0 && (signals.fields ?? 0) > 0) needs.add("simplify");
  return [...needs];
}

function normalizeComplaint(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 900);
}

export function encodeRepairRequestHandoff(input: Omit<RepairRequestHandoff, "version" | "source">) {
  const payload: RepairRequestHandoff = {
    version: 1,
    source: "extension",
    target: input.target.trim().slice(0, 2048),
    complaint: normalizeComplaint(input.complaint),
    needs: [...new Set(input.needs.filter((need): need is HandoffNeed => HANDOFF_NEEDS.includes(need)))]
  };
  return `${REQUEST_HANDOFF_KEY}=${encodeURIComponent(JSON.stringify(payload))}`;
}

export function buildCommunityRequestUrl(input: Omit<RepairRequestHandoff, "version" | "source">) {
  return `${COMMUNITY_REQUEST_URL}#${encodeRepairRequestHandoff(input)}`;
}

export function decodeRepairRequestHandoff(fragment: string): RepairRequestHandoff | null {
  const rawFragment = fragment.replace(/^#/, "");
  if (!rawFragment || rawFragment.length > 6000) return null;
  const params = new URLSearchParams(rawFragment);
  const encoded = params.get(REQUEST_HANDOFF_KEY);
  if (!encoded) return null;
  try {
    const value = JSON.parse(encoded) as Partial<RepairRequestHandoff>;
    if (value.version !== 1 || value.source !== "extension" || typeof value.target !== "string" || typeof value.complaint !== "string" || !Array.isArray(value.needs)) return null;
    const complaint = normalizeComplaint(value.complaint);
    if (complaint.length < 12 || value.target.length === 0 || value.target.length > 2048) return null;
    const needs = [...new Set(value.needs.filter((need): need is HandoffNeed => typeof need === "string" && HANDOFF_NEEDS.includes(need as HandoffNeed)))];
    return { version: 1, source: "extension", target: value.target, complaint, needs };
  } catch {
    return null;
  }
}
