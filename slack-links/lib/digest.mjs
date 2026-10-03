// Formats the weekly digest for Slack and sends it to you as a DM.
// One short message up top (the read on your week, plus an index of threads),
// then every link, one line each, in a thread underneath.

const slackEsc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MAX_CHARS = 3500; // keep each message comfortably inside Slack's limits
const TITLE_MAX = 70;

function shorten(s, n) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function linkLine(l) {
  const a = l.analysis;
  const title = slackEsc(shorten(a?.title || l.preview?.title || l.url, TITLE_MAX)).replace(/\|/g, "/");
  const flags = [];
  if (l.saves.length > 1) flags.push(`${l.saves.length}×`);
  if ((l.fetched?.status ?? 200) >= 400) flags.push("dead");
  const why = a ? a.why_short || a.why_saved : l.note;
  return `• <${l.url}|${title}>${why ? ` · ${slackEsc(why)}` : ""}${flags.length ? ` _(${flags.join(", ")})_` : ""}`;
}

export function buildDigest(links, week, { from, to }) {
  const byId = new Map(links.map((l) => [l.id, l]));
  const fmt = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const groups = [...week.groups];
  const unanalysed = links.filter((l) => !l.analysis).map((l) => l.id);
  if (unanalysed.length) groups.push({ name: "Couldn't analyse these", gist: "Listed as you saved them", link_ids: unanalysed });

  let head = `*Your week in links* · ${fmt(from)} – ${fmt(to)} · ${links.length} saved\n\n${slackEsc(week.summary)}`;
  if (week.nudges.length) head += `\n\n*This week, maybe:*\n${week.nudges.map((n) => `→ ${slackEsc(n)}`).join("\n")}`;
  if (groups.length) {
    head += `\n\n*What you were circling:*\n`;
    head += groups.map((g, i) => `${i + 1}. *${slackEsc(g.name)}* (${g.link_ids.length}) · ${slackEsc(g.gist || "")}`).join("\n");
    head += `\n\n_Every link is in the thread 🧵, one line each._`;
  }

  const thread = [];
  groups.forEach((g, i) => {
    const title = `*${i + 1}. ${slackEsc(g.name)}*`;
    let current = `${title} (${g.link_ids.length})`;
    for (const line of g.link_ids.map((id) => byId.get(id)).filter(Boolean).map(linkLine)) {
      if (current.length + line.length + 1 > MAX_CHARS) {
        thread.push(current);
        current = `${title} (cont.)`;
      }
      current += `\n${line}`;
    }
    thread.push(current);
  });
  return { head, thread };
}

async function slack(token, method, body) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Slack ${method} failed: ${json.error}`);
  return json;
}

// With a bot token the DM comes from the app, so you get a notification.
// Without one it goes into your own "notes to self" DM (no notification).
export async function sendDigest({ head, thread }, { userToken, botToken }) {
  const me = (await slack(userToken, "auth.test", {})).user_id;
  const token = botToken || userToken;
  const channel = botToken ? (await slack(botToken, "conversations.open", { users: me })).channel.id : me;
  const post = (text, extra = {}) =>
    slack(token, "chat.postMessage", { channel, text, unfurl_links: false, unfurl_media: false, mrkdwn: true, ...extra });

  const top = await post(head);
  for (const text of thread) {
    await new Promise((r) => setTimeout(r, 1100)); // stay under Slack's 1 msg/sec limit
    await post(text, { thread_ts: top.ts });
  }
  return 1 + thread.length;
}
