import { RepairSubmissionError, validateRepairSubmission } from "../src/core/repair-submission";

const githubIssuesUrl = "https://api.github.com/repos/abbasaliii/patch-the-web/issues";
const publicQueueUrl = "https://patch-the-web.vercel.app/requests/";
const attempts = new Map<string, number[]>();

function json(value: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders
    }
  });
}

function directSubmissionReady() {
  return process.env.REPAIR_SUBMISSION_ENABLED === "true" && Boolean(process.env.GITHUB_REPAIR_TOKEN?.trim());
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function clientBucket(request: Request) {
  return request.headers.get("x-vercel-forwarded-for")?.split(",", 1)[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim()
    || "unknown";
}

function isRateLimited(request: Request, now = Date.now()) {
  if (attempts.size > 1_000) attempts.clear();
  const key = clientBucket(request);
  const recent = (attempts.get(key) ?? []).filter((timestamp) => now - timestamp < 60 * 60 * 1_000);
  if (recent.length >= 3) return true;
  recent.push(now);
  attempts.set(key, recent);
  return false;
}

async function post(request: Request) {
  if (!directSubmissionReady()) {
    return json({ error: "submission_unavailable", message: "Direct submission is temporarily unavailable. Use the reviewed GitHub option instead.", fallback: "github" }, 503);
  }
  if (!isSameOrigin(request)) return json({ error: "origin_rejected", message: "Start this request from Patch the Web." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "unsupported_media_type", message: "Send the repair request as JSON." }, 415);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 12_000) return json({ error: "request_too_large", message: "The repair request is too large." }, 413);
  if (isRateLimited(request)) return json({ error: "rate_limited", message: "Too many requests were sent from this network. Try again later." }, 429, { "Retry-After": "3600" });

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return json({ error: "invalid_request", message: "The repair request could not be read." }, 400);
  }
  if (raw.length > 12_000) return json({ error: "request_too_large", message: "The repair request is too large." }, 413);

  try {
    const submission = validateRepairSubmission(JSON.parse(raw) as unknown);
    const response = await fetch(githubIssuesUrl, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${process.env.GITHUB_REPAIR_TOKEN!.trim()}`,
        "Content-Type": "application/json",
        "User-Agent": "patch-the-web-intake",
        "X-GitHub-Api-Version": "2026-03-10"
      },
      body: JSON.stringify(submission.issue)
    });
    if (!response.ok) {
      console.error("Repair intake upstream failure", response.status);
      return json({ error: "upstream_unavailable", message: "The community queue could not accept the request. Nothing was published; try the GitHub option instead.", fallback: "github" }, 502);
    }
    const created = await response.json() as { number?: unknown; html_url?: unknown };
    if (!Number.isInteger(created.number) || typeof created.html_url !== "string") throw new Error("Malformed GitHub response");
    const issueUrl = new URL(created.html_url);
    if (issueUrl.origin !== "https://github.com" || issueUrl.pathname !== `/abbasaliii/patch-the-web/issues/${created.number}`) throw new Error("Unexpected GitHub issue URL");
    return json({ status: "submitted", number: created.number, url: issueUrl.toString(), queue: publicQueueUrl }, 201);
  } catch (error) {
    if (error instanceof RepairSubmissionError) return json({ error: error.code, message: error.message }, 400);
    if (error instanceof SyntaxError) return json({ error: "invalid_json", message: "The repair request is malformed." }, 400);
    console.error("Repair intake failure", error instanceof Error ? error.message : "unknown");
    return json({ error: "invalid_request", message: "The repair request could not be submitted safely." }, 400);
  }
}

export default {
  async fetch(request: Request) {
    if (request.method === "GET") {
      return json({ service: "patch-the-web-repair-intake", directSubmission: directSubmissionReady(), queue: publicQueueUrl });
    }
    if (request.method === "POST") return post(request);
    return json({ error: "method_not_allowed" }, 405, { "Allow": "GET, POST" });
  }
};
