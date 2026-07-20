/**
 * Patch receipts are calculated from the bytes that OpenPatch publishes.
 * Git may check text files out with platform-specific line endings, so the
 * registry always publishes and hashes a canonical LF representation.
 */
export function canonicalPatchSource(raw: string) {
  return raw.replace(/\r\n?/g, "\n");
}
