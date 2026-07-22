const TRUSTED_ORIGIN = "https://patch-the-web.vercel.app";
const REQUEST_TYPE = "PATCH_THE_WEB_AUTHOR_HANDOFF";
const RESPONSE_TYPE = "PATCH_THE_WEB_AUTHOR_HANDOFF_RESULT";

type AuthorHandoffMessage = {
  type: typeof REQUEST_TYPE;
  requestId: string;
  raw: string;
  target: string;
};

function isHandoffMessage(value: unknown): value is AuthorHandoffMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<AuthorHandoffMessage>;
  return candidate.type === REQUEST_TYPE
    && typeof candidate.requestId === "string"
    && /^[a-f0-9-]{16,80}$/i.test(candidate.requestId)
    && typeof candidate.raw === "string"
    && new TextEncoder().encode(candidate.raw).byteLength > 0
    && new TextEncoder().encode(candidate.raw).byteLength <= 256_000
    && typeof candidate.target === "string"
    && candidate.target.length <= 2_048;
}

window.addEventListener("message", (event) => {
  if (location.origin !== TRUSTED_ORIGIN || event.origin !== TRUSTED_ORIGIN || event.source !== window || !isHandoffMessage(event.data)) return;
  const request = event.data;
  void chrome.runtime.sendMessage({
    type: "PATCH_THE_WEB_START_AUTHOR_TEST",
    requestId: request.requestId,
    raw: request.raw,
    target: request.target
  }).then((response: { ok?: unknown; error?: unknown } | undefined) => {
    window.postMessage({
      type: RESPONSE_TYPE,
      requestId: request.requestId,
      ok: response?.ok === true,
      error: typeof response?.error === "string" ? response.error : undefined
    }, TRUSTED_ORIGIN);
  }).catch(() => {
    window.postMessage({ type: RESPONSE_TYPE, requestId: request.requestId, ok: false, error: "The extension bridge did not respond." }, TRUSTED_ORIGIN);
  });
});
