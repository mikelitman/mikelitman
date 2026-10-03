// Fetches the links you posted to Slack since a given date, oldest first.

import { readFromApi, mergeLinks } from "./slack.mjs";

export async function collectSince(token, since, { query = "has:link from:me" } = {}) {
  // Slack's "after:" excludes the given day, so ask from a day earlier and trim.
  const after = new Date(since - 86400_000).toISOString().slice(0, 10);
  return (await readFromApi(token, { query: `${query} after:${after}` })).filter((l) => new Date(l.savedAt) >= since);
}

export function numbered(raw, firstId = 1) {
  return mergeLinks(raw)
    .sort((a, b) => a.savedAt.localeCompare(b.savedAt))
    .map((l, i) => ({ id: firstId + i, ...l }));
}
