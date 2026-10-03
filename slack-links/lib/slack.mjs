// Pulls every link out of Slack, with the context around it (what you wrote,
// the thread, the channel, when). Two sources: an unzipped Slack export
// folder, or the Slack API with a user token.

import fs from "node:fs";
import path from "node:path";

const LINK_RE = /<(https?:\/\/[^>|\s]+)(?:\|([^>]*))?>/g;
const SKIP_HOSTS = [/(^|\.)slack\.com$/, /(^|\.)slack-edge\.com$/, /(^|\.)slack-files\.com$/];

export function normaliseUrl(raw) {
  try {
    const u = new URL(raw.replace(/&amp;/g, "&"));
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref_src|igshid|si$)/i.test(k)) u.searchParams.delete(k);
    }
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

function keepUrl(url) {
  try {
    const host = new URL(url).hostname;
    return !SKIP_HOSTS.some((re) => re.test(host));
  } catch {
    return false;
  }
}

// Slack markup -> readable text: <@U123> mentions, <#C1|name> channels, links.
function cleanText(text = "") {
  return text
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/<@([A-Z0-9]+)>/g, "@$1")
    .replace(LINK_RE, (_, url, label) => label || url)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// Turn one Slack message into zero or more link records.
function linksFromMessage(msg, channel, extraContext = []) {
  const found = new Map();
  for (const m of (msg.text || "").matchAll(LINK_RE)) {
    const url = normaliseUrl(m[1]);
    if (url && keepUrl(url)) found.set(url, {});
  }
  // Slack's own link previews ("unfurls") carry a free title and description.
  for (const a of msg.attachments || []) {
    const url = normaliseUrl(a.from_url || a.original_url || a.title_link || "");
    if (!url || !keepUrl(url)) continue;
    found.set(url, {
      title: a.title || a.fallback || "",
      description: (a.text || "").slice(0, 500),
      site: a.service_name || "",
    });
  }
  const note = cleanText((msg.text || "").replace(LINK_RE, "")).replace(/https?:\/\/\S+/g, "").trim();
  const ts = Number(msg.ts);
  return [...found].map(([url, preview]) => ({
    url,
    savedAt: new Date(ts * 1000).toISOString(),
    channel,
    note,
    context: extraContext.filter(Boolean),
    preview,
  }));
}

// --- Source 1: Slack export (Workspace settings -> Import/Export -> Export) ---

export function readExport(dir, { userId } = {}) {
  if (!fs.existsSync(path.join(dir, "channels.json")) && !fs.existsSync(path.join(dir, "users.json"))) {
    throw new Error(`${dir} doesn't look like an unzipped Slack export (no channels.json / users.json).`);
  }
  const links = [];
  const channelDirs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const channel of channelDirs) {
    const files = fs.readdirSync(path.join(dir, channel)).filter((f) => f.endsWith(".json")).sort();
    const messages = files.flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, channel, f), "utf8")));
    messages.sort((a, b) => Number(a.ts) - Number(b.ts));

    const replies = new Map();
    for (const m of messages) {
      if (m.thread_ts && m.thread_ts !== m.ts) {
        if (!replies.has(m.thread_ts)) replies.set(m.thread_ts, []);
        replies.get(m.thread_ts).push(cleanText(m.text));
      }
    }

    messages.forEach((m, i) => {
      if (m.subtype && m.subtype !== "thread_broadcast") return;
      if (userId && m.user !== userId) return;
      // Messages you posted just before/after (within 10 min) often explain the link.
      const near = [messages[i - 1], messages[i + 1]]
        .filter((n) => n && !n.subtype && n.user === m.user && Math.abs(Number(n.ts) - Number(m.ts)) < 600)
        .map((n) => cleanText(n.text));
      const thread = replies.get(m.ts) || [];
      links.push(...linksFromMessage(m, channel, [...near, ...thread.map((t) => `(thread reply) ${t}`)]));
    });
  }
  return links;
}

// --- Source 2: Slack API (user token with the search:read scope) ---

export async function readFromApi(token, { query = "has:link from:me", maxPages = 100 } = {}) {
  const links = [];
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({ query, count: "100", page: String(page), sort: "timestamp" });
    const res = await fetch(`https://slack.com/api/search.messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") || 5);
      await new Promise((r) => setTimeout(r, wait * 1000));
      page--;
      continue;
    }
    const body = await res.json();
    if (!body.ok) throw new Error(`Slack API error: ${body.error}`);
    for (const m of body.messages.matches) {
      const ctx = [m.previous?.text, m.next?.text].filter(Boolean).map(cleanText);
      links.push(...linksFromMessage(m, m.channel?.name || "dm", ctx));
    }
    process.stdout.write(`\r  Slack: page ${page}/${body.messages.paging.pages}, ${links.length} links`);
    if (page >= body.messages.paging.pages) break;
  }
  process.stdout.write("\n");
  return links;
}

// Same URL saved more than once is a signal in itself: merge and keep every save.
export function mergeLinks(links) {
  const byUrl = new Map();
  for (const l of links) {
    const existing = byUrl.get(l.url);
    if (!existing) {
      byUrl.set(l.url, { ...l, saves: [{ savedAt: l.savedAt, channel: l.channel, note: l.note }] });
      continue;
    }
    existing.saves.push({ savedAt: l.savedAt, channel: l.channel, note: l.note });
    if (l.savedAt < existing.savedAt) existing.savedAt = l.savedAt;
    if (!existing.preview?.title && l.preview?.title) existing.preview = l.preview;
    existing.context = [...new Set([...existing.context, ...l.context])];
  }
  return [...byUrl.values()];
}
