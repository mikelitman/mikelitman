// Formats the weekly digest as Slack messages and sends it to you as a DM.

const slackEsc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MAX_CHARS = 3500; // keep each message comfortably inside Slack's limits

function linkLine(l) {
  const a = l.analysis;
  const extras = [a.intent];
  if (l.saves.length > 1) extras.push(`saved ${l.saves.length}×`);
  if ((l.fetched?.status ?? 200) >= 400) extras.push("link looks dead");
  const lines = [
    `• <${l.url}|${slackEsc(a.title).replace(/\|/g, "/")}>  _${extras.join(" · ")}_`,
    `      ${slackEsc(a.summary)}`,
    `      *Why:* ${slackEsc(a.why_saved)}`,
  ];
  return lines.join("\n");
}

function plainLine(l) {
  // Links Claude couldn't analyse still get listed, so nothing goes missing.
  return `• <${l.url}|${slackEsc(l.preview?.title || l.url).replace(/\|/g, "/")}>${l.note ? `\n      You wrote: ${slackEsc(l.note)}` : ""}`;
}

export function buildDigest(links, week, { from, to }) {
  const byId = new Map(links.map((l) => [l.id, l]));
  const range = `${from.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${to.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  const messages = [];

  let head = `*Your week in links* · ${range} · ${links.length} saved\n\n${slackEsc(week.summary)}`;
  if (week.nudges.length) head += `\n\n*This week, maybe:*\n${week.nudges.map((n) => `→ ${slackEsc(n)}`).join("\n")}`;
  messages.push(head);

  const unanalysed = links.filter((l) => !l.analysis);
  const groups = [...week.groups];
  if (unanalysed.length) groups.push({ name: "Couldn't analyse these", link_ids: unanalysed.map((l) => l.id), plain: true });

  for (const g of groups) {
    const lines = g.link_ids.map((id) => byId.get(id)).filter(Boolean).map((l) => (g.plain || !l.analysis ? plainLine(l) : linkLine(l)));
    let current = `*${slackEsc(g.name)}* (${lines.length})`;
    for (const line of lines) {
      if (current.length + line.length + 2 > MAX_CHARS) {
        messages.push(current);
        current = `*${slackEsc(g.name)}* (cont.)`;
      }
      current += `\n\n${line}`;
    }
    messages.push(current);
  }
  return messages;
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
export async function sendDigest(messages, { userToken, botToken }) {
  const me = (await slack(userToken, "auth.test", {})).user_id;
  const token = botToken || userToken;
  const channel = botToken ? (await slack(botToken, "conversations.open", { users: me })).channel.id : me;
  for (const text of messages) {
    await slack(token, "chat.postMessage", { channel, text, unfurl_links: false, unfurl_media: false, mrkdwn: true });
    await new Promise((r) => setTimeout(r, 1100)); // stay under Slack's 1 msg/sec limit
  }
}
