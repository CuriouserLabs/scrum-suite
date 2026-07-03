/**
 * Shorten an assignee's display name so it fits inside the tight action-item
 * card chip without wrapping or blowing out the layout. The rules mirror the
 * product ask (#107): prefer the whole name, otherwise fall back to the first
 * space-separated part, and only truncate with an ellipsis when even that first
 * part is too long to show in full.
 */
export function truncateAssigneeName(name: string, maxChars = 12): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return trimmed;

  // Doesn't fit whole — show just the first part (e.g. "Alexandra" from
  // "Alexandra Fitzgerald") if that alone fits.
  const firstPart = trimmed.split(/\s+/)[0];
  if (firstPart.length <= maxChars) return firstPart;

  // Even the first part is too long — hard-truncate, reserving room for the "…".
  return firstPart.slice(0, Math.max(1, maxChars - 1)) + '…';
}
