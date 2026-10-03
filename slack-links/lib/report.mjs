// Writes a single self-contained HTML file: no server, open it in a browser.

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function buildReport(links, themes) {
  const data = links
    .filter((l) => l.analysis)
    .map((l) => ({
      id: l.id,
      url: l.url,
      date: l.savedAt.slice(0, 10),
      channel: l.channel,
      saves: l.saves.length,
      note: [...new Set(l.saves.map((s) => s.note).filter(Boolean))].join(" | "),
      dead: (l.fetched?.status ?? 200) >= 400,
      ...l.analysis,
    }));
  const json = JSON.stringify({ links: data, themes }).replace(/</g, "\\u003c");
  const generated = new Date().toISOString().slice(0, 10);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link Archaeology</title>
<style>
:root{--bg:#faf9f7;--card:#fff;--ink:#1b1b1a;--muted:#6b6a66;--line:#e6e3dd;--accent:#c2410c;--accent-soft:#fdeee5;--bar:#d6d2ca}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1e1c;--ink:#ecebe7;--muted:#9c9a93;--line:#2f2e2b;--accent:#fb923c;--accent-soft:#3a2417;--bar:#46443f}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
main{max-width:1040px;margin:0 auto;padding:40px 16px 80px}
h1{font-size:34px;letter-spacing:-.02em;margin:0 0 4px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:48px 0 14px;font-weight:600}
.sub{color:var(--muted);margin:0 0 24px}
.portrait{font-size:19px;line-height:1.6;max-width:760px}
.stats{display:flex;gap:28px;flex-wrap:wrap;margin:28px 0 0}
.stat b{display:block;font-size:26px}.stat span{color:var(--muted);font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px}
.theme{cursor:pointer;transition:border-color .15s}.theme:hover,.theme.on{border-color:var(--accent)}
.theme h3{margin:0 0 6px;font-size:17px}
.theme p{margin:0 0 10px;font-size:14px}
.why{color:var(--muted);font-size:14px}
.pill{display:inline-block;font-size:12px;padding:2px 8px;border-radius:99px;background:var(--accent-soft);color:var(--accent);margin-right:6px}
.spark{display:flex;align-items:flex-end;gap:2px;height:28px;margin-top:10px}.spark i{flex:1;background:var(--bar);border-radius:2px;min-height:2px}
.timeline{display:flex;align-items:flex-end;gap:3px;height:120px;border-bottom:1px solid var(--line)}
.timeline div{flex:1;background:var(--accent);opacity:.75;border-radius:3px 3px 0 0;min-height:1px}
.tl-labels{display:flex;justify-content:space-between;color:var(--muted);font-size:12px;margin-top:6px}
.resurface a,.link a{color:var(--ink);font-weight:600;text-decoration:none}.resurface a:hover,.link a:hover{color:var(--accent)}
.resurface li{margin-bottom:14px}.resurface ul,.loops{padding-left:20px}
.controls{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
input,select{font:inherit;padding:8px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink)}
input{flex:1;min-width:200px}
.link{padding:14px 0;border-bottom:1px solid var(--line)}
.meta{color:var(--muted);font-size:13px;margin-top:2px}
.link .why{margin-top:6px}.link .summary{font-size:14px;margin-top:4px}
.note{font-size:13px;border-left:2px solid var(--line);padding-left:8px;margin-top:6px;color:var(--muted)}
.dead{color:#b91c1c}
#count{color:var(--muted);font-size:13px;margin-bottom:6px}
</style>
</head>
<body>
<main>
<h1>Link Archaeology</h1>
<p class="sub">Everything you've dropped into Slack, and why. Generated ${esc(generated)}.</p>
<p class="portrait" id="portrait"></p>
<div class="stats" id="stats"></div>

<h2>Saves over time</h2>
<div class="timeline" id="timeline"></div><div class="tl-labels" id="tl-labels"></div>

<h2>Themes running through it</h2>
<div class="grid" id="themes"></div>

<h2>Worth going back to</h2>
<div class="card resurface"><ul id="resurface"></ul></div>

<h2>Open loops</h2>
<div class="card"><ul class="loops" id="loops"></ul></div>

<h2>Everything</h2>
<div class="controls">
  <input id="q" type="search" placeholder="Search titles, reasons, notes, tags">
  <select id="cat"><option value="">All categories</option></select>
  <select id="intent"><option value="">Any intent</option></select>
  <select id="sort"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="saves">Most re-saved</option></select>
</div>
<div id="count"></div>
<div id="list"></div>
</main>
<script>
const D = ${json};
const $ = (id) => document.getElementById(id);
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const byId = new Map(D.links.map((l) => [l.id, l]));
let activeTheme = null;

$("portrait").textContent = D.themes.portrait;
const months = [...new Set(D.links.map((l) => l.date.slice(0, 7)))].sort();
const span = (() => { if (!months.length) return []; const out = []; let [y, m] = months[0].split("-").map(Number); const [ey, em] = months.at(-1).split("-").map(Number); while (y < ey || (y === ey && m <= em)) { out.push(y + "-" + String(m).padStart(2, "0")); m++; if (m > 12) { m = 1; y++; } } return out; })();
const perMonth = (ids) => { const c = Object.fromEntries(span.map((m) => [m, 0])); for (const l of ids) c[l.date.slice(0, 7)]++; return span.map((m) => c[m]); };

const stats = [
  [D.links.length, "links"],
  [D.themes.themes.length, "themes"],
  [D.links.filter((l) => l.saves > 1).length, "saved more than once"],
  [D.links.filter((l) => l.dead).length, "now dead"],
];
$("stats").innerHTML = stats.map(([n, t]) => '<div class="stat"><b>' + n + '</b><span>' + t + '</span></div>').join("");

const all = perMonth(D.links), max = Math.max(1, ...all);
$("timeline").innerHTML = all.map((n, i) => '<div title="' + span[i] + ': ' + n + '" style="height:' + (n / max * 100) + '%"></div>').join("");
$("tl-labels").innerHTML = span.length ? '<span>' + span[0] + '</span><span>' + span.at(-1) + '</span>' : "";

$("themes").innerHTML = D.themes.themes.map((t, i) => {
  const ls = t.link_ids.map((id) => byId.get(id)).filter(Boolean);
  const s = perMonth(ls), mx = Math.max(1, ...s);
  return '<div class="card theme" data-i="' + i + '"><h3>' + esc(t.name) + '</h3><p>' + esc(t.description) + '</p><p class="why">' + esc(t.why_it_matters) + '</p>' +
    '<span class="pill">' + ls.length + ' links</span><span class="pill">' + esc(t.trend) + '</span>' +
    '<div class="spark">' + s.map((n) => '<i style="height:' + (n / mx * 100) + '%"></i>').join("") + '</div></div>';
}).join("");
document.querySelectorAll(".theme").forEach((el) => el.onclick = () => {
  const i = Number(el.dataset.i);
  activeTheme = activeTheme === i ? null : i;
  document.querySelectorAll(".theme").forEach((t) => t.classList.toggle("on", Number(t.dataset.i) === activeTheme));
  render();
  if (activeTheme !== null) $("q").scrollIntoView({ behavior: "smooth" });
});

$("resurface").innerHTML = D.themes.resurface.map((r) => {
  const l = byId.get(r.id); if (!l) return "";
  return '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.title) + '</a><div class="why">' + esc(r.reason) + '</div><div class="meta">Saved ' + l.date + '</div></li>';
}).join("");
$("loops").innerHTML = D.themes.open_loops.map((o) => '<li>' + esc(o) + '</li>').join("");

const fill = (sel, vals) => sel.innerHTML += [...new Set(vals)].sort().map((v) => '<option>' + esc(v) + '</option>').join("");
fill($("cat"), D.links.map((l) => l.category));
fill($("intent"), D.links.map((l) => l.intent));

function render() {
  const q = $("q").value.toLowerCase().trim(), cat = $("cat").value, intent = $("intent").value, sort = $("sort").value;
  const themeIds = activeTheme === null ? null : new Set(D.themes.themes[activeTheme].link_ids);
  let rows = D.links.filter((l) =>
    (!cat || l.category === cat) && (!intent || l.intent === intent) && (!themeIds || themeIds.has(l.id)) &&
    (!q || [l.title, l.summary, l.why_saved, l.note, l.url, l.tags.join(" ")].join(" ").toLowerCase().includes(q)));
  rows.sort(sort === "old" ? (a, b) => a.date.localeCompare(b.date) : sort === "saves" ? (a, b) => b.saves - a.saves : (a, b) => b.date.localeCompare(a.date));
  $("count").textContent = rows.length + " links" + (themeIds ? " in “" + D.themes.themes[activeTheme].name + "” (click the theme again to clear)" : "");
  $("list").innerHTML = rows.slice(0, 500).map((l) =>
    '<div class="link"><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.title) + '</a>' +
    '<div class="meta">' + l.date + ' · #' + esc(l.channel) + ' · ' + esc(l.category) + ' · ' + esc(l.type) + ' · ' + esc(l.intent) +
    (l.saves > 1 ? ' · saved ' + l.saves + '×' : '') + (l.dead ? ' · <span class="dead">link dead</span>' : '') + '</div>' +
    '<div class="summary">' + esc(l.summary) + '</div><div class="why">Why you saved it: ' + esc(l.why_saved) + '</div>' +
    (l.note ? '<div class="note">You wrote: ' + esc(l.note) + '</div>' : '') + '</div>').join("") +
    (rows.length > 500 ? '<p class="meta">Showing first 500. Search or filter to narrow down.</p>' : "");
}
["q", "cat", "intent", "sort"].forEach((id) => $(id).addEventListener("input", render));
render();
</script>
</body>
</html>`;
}
