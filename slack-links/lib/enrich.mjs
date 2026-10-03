// Fills in title/description for links Slack didn't preview, by reading the
// page's <title> and meta tags. Dead links are flagged rather than dropped.

const TIMEOUT_MS = 8000;
const MAX_BYTES = 300_000;

function meta(html, names) {
  for (const n of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${n}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${n}["']`,
      "i",
    );
    const m = html.match(re);
    if (m) return decode(m[1] ?? m[2]);
  }
  return "";
}

function decode(s = "") {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function readCapped(res) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  return Buffer.concat(chunks).toString("utf8");
}

export async function fetchPreview(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (link-archaeology; personal bookmark review)" },
    });
    if (!res.ok) return { status: res.status };
    if (!(res.headers.get("content-type") || "").includes("html")) return { status: res.status };
    const html = await readCapped(res);
    return {
      status: res.status,
      title: meta(html, ["og:title", "twitter:title"]) || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]),
      description: meta(html, ["og:description", "description", "twitter:description"]).slice(0, 500),
      site: meta(html, ["og:site_name"]),
    };
  } catch (err) {
    return { status: 0, error: err.name === "TimeoutError" ? "timeout" : "unreachable" };
  }
}

export async function enrichAll(links, { concurrency = 8 } = {}) {
  const todo = links.filter((l) => !l.preview?.title && !l.fetched);
  let done = 0;
  const worker = async () => {
    while (todo.length) {
      const link = todo.shift();
      const p = await fetchPreview(link.url);
      link.fetched = { status: p.status, error: p.error };
      if (p.title) link.preview = { title: p.title, description: p.description, site: p.site };
      process.stdout.write(`\r  Reading pages: ${++done}`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (done) process.stdout.write("\n");
}
