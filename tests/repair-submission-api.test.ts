import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import repairRequestsApi from "../api/repair-requests";

function payload() {
  return {
    request: {
      schemaVersion: 1,
      kind: "patch-the-web-repair-request",
      publicScope: "https://example.edu/programs?private=yes",
      complaint: "I only want to see the programs that are available in Karachi.",
      needs: ["filter"],
      criteria: ["Show only programs available in Karachi."]
    },
    consent: true,
    openedAt: Date.now() - 3_000,
    submissionId: "123e4567-e89b-42d3-a456-426614174000",
    website: ""
  };
}

function post(body: unknown, ip: string) {
  return new Request("https://patch-the-web.vercel.app/api/repair-requests", {
    method: "POST",
    headers: { "content-type": "application/json", "origin": "https://patch-the-web.vercel.app", "x-forwarded-for": ip },
    body: JSON.stringify(body)
  });
}

describe("repair request API", () => {
  beforeEach(() => {
    process.env.REPAIR_SUBMISSION_ENABLED = "true";
    process.env.GITHUB_REPAIR_TOKEN = "test-token";
  });

  afterEach(() => {
    delete process.env.REPAIR_SUBMISSION_ENABLED;
    delete process.env.GITHUB_REPAIR_TOKEN;
    vi.unstubAllGlobals();
  });

  it("creates a safely bounded public request without exposing the token", async () => {
    const upstream = vi.fn(async () => new Response(JSON.stringify({ number: 41, html_url: "https://github.com/abbasaliii/patch-the-web/issues/41" }), { status: 201 }));
    vi.stubGlobal("fetch", upstream);
    const response = await repairRequestsApi.fetch(post(payload(), "192.0.2.41"));
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result).toEqual({ status: "submitted", number: 41, url: "https://github.com/abbasaliii/patch-the-web/issues/41", queue: "https://patch-the-web.vercel.app/requests/" });
    expect(upstream).toHaveBeenCalledOnce();
    const [, init] = upstream.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-token");
    const issue = JSON.parse(String(init.body));
    expect(issue.labels).toEqual(["repair-request", "needs-triage"]);
    expect(issue.body).not.toContain("private=yes");
    expect(JSON.stringify(result)).not.toContain("test-token");
  });

  it("fails closed when direct intake is not configured", async () => {
    delete process.env.GITHUB_REPAIR_TOKEN;
    const status = await repairRequestsApi.fetch(new Request("https://patch-the-web.vercel.app/api/repair-requests"));
    await expect(status.json()).resolves.toMatchObject({ directSubmission: false });
    const response = await repairRequestsApi.fetch(post(payload(), "192.0.2.42"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "submission_unavailable", fallback: "github" });
  });

  it("rejects cross-origin, malformed, oversized, and likely private submissions before GitHub", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const crossOrigin = post(payload(), "192.0.2.43");
    crossOrigin.headers.set("origin", "https://attacker.example");
    expect((await repairRequestsApi.fetch(crossOrigin)).status).toBe(403);
    const privatePayload = payload();
    privatePayload.request.complaint = "My email student@example.edu should be shown beside every program.";
    const privateResponse = await repairRequestsApi.fetch(post(privatePayload, "192.0.2.44"));
    expect(privateResponse.status).toBe(400);
    await expect(privateResponse.json()).resolves.toMatchObject({ error: "private_data_detected" });
    const oversized = post(payload(), "192.0.2.45");
    oversized.headers.set("content-length", "12001");
    expect((await repairRequestsApi.fetch(oversized)).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("throttles repeated writes from one warm-instance network bucket", async () => {
    let number = 50;
    vi.stubGlobal("fetch", vi.fn(async () => {
      number += 1;
      return new Response(JSON.stringify({ number, html_url: `https://github.com/abbasaliii/patch-the-web/issues/${number}` }), { status: 201 });
    }));
    for (let attempt = 0; attempt < 3; attempt += 1) expect((await repairRequestsApi.fetch(post(payload(), "192.0.2.99"))).status).toBe(201);
    const blocked = await repairRequestsApi.fetch(post(payload(), "192.0.2.99"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("3600");
  });
});
