import type { OpenPatch } from "./types";

function hostMatches(pattern: string, host: string) {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1);
    return host.endsWith(suffix) && host !== suffix.slice(1);
  }
  return pattern === host;
}

function pathMatches(pattern: string, pathname: string) {
  if (pattern.endsWith("*")) return pathname.startsWith(pattern.slice(0, -1));
  return pattern === pathname;
}

export function patchMatchesUrl(patch: OpenPatch, url: URL) {
  return patch.match.hosts.some((host) => hostMatches(host, url.hostname)) &&
    patch.match.paths.some((path) => pathMatches(path, url.pathname));
}
