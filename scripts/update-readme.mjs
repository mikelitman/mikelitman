// Refreshes the live sections of README.md from Mike's own products:
//   1) PATTERN  - "Today's culture signal" card from thepattern.media/feed.xml
//   2) METRICS  - self-healing project number tags, e.g. (140+ sources)
//   3) WRITING  - latest blog posts from mikelitman.me/feed.xml
//   4) STAMP    - "last refresh" self-maintenance line
// The "Building this week" line is intentionally NOT touched here so Mike's
// own edits to it always survive. Every fetch is wrapped in try/catch, so one
// unreachable source never breaks the others or the README.

import { readFile, writeFile } from 'node:fs/promises';

const README = new URL('../README.md', import.meta.url);
const UA = { headers: { 'user-agent': 'mikelitman-profile-bot' } };

const METRICS = [
  { url: 'https://cultureterminal.com', re: /(\d[\d,]*\+?\s*sources)/i },
  { url: 'https://therelevanceindex.com', re: /(\d[\d,]*\+?\s*brands)/i },
  { url: 'https://taste-os.netlify.app', re: /(\d[\d,]*\+?\s*brands)/i },
  { url: 'https://littlelondonco.com', re: /(\d[\d,]*\+?\s*activities)/i },
];

const ACRONYMS = {
  ai: 'AI', x: 'X', nft: 'NFT', nfts: 'NFTs', ui: 'UI', ux: 'UX', api: 'API',
  llm: 'LLM', og: 'OG', seo: 'SEO', cro: 'CRO', mra: 'MRA', gw: 'GW',
  github: 'GitHub', ios: 'iOS', b2b: 'B2B', b2c: 'B2C',
};

function decode(s) {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&nbsp;/g, ' ')
    .trim();
}
const pick = (s, re) => { const m = s.match(re); return m ? decode(m[1]) : null; };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replaceBlock(content, name, inner) {
  const start = `<!-- ${name}:START -->`;
  const end = `<!-- ${name}:END -->`;
  const re = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!re.test(content)) throw new Error(`${name} markers missing`);
  return content.replace(re, `${start}\n${inner}\n${end}`);
}

function humanize(slug) {
  const words = slug.split('-').map((w) => ACRONYMS[w.toLowerCase()] || w);
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmt(pubDate, opts) {
  return new Date(pubDate).toLocaleDateString('en-GB', opts);
}

async function refreshPattern(content) {
  try {
    const res = await fetch('https://thepattern.media/feed.xml', UA);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const item = pick(xml, /<item>([\s\S]*?)<\/item>/i);
    if (!item) throw new Error('no item');
    const title = pick(item, /<title>([\s\S]*?)<\/title>/i) || '';
    const desc = pick(item, /<description>([\s\S]*?)<\/description>/i) || '';
    const pubDate = pick(item, /<pubDate>([\s\S]*?)<\/pubDate>/i);

    const edition = (title.match(/No\.\s*(\d+)/) || [])[1];
    const headline = decode(title.replace(/^No\.\s*\d+:\s*/, ''));
    const pulse = (desc.match(/Culture Pulse:\s*(\d+)/i) || [])[1];
    const editionUrl =
      (desc.match(/(https:\/\/thepattern\.media\/editions\/[^\s]+)/) || [])[1] ||
      'https://thepattern.media';
    const insight = decode(
      desc.replace(/Culture Pulse:\s*\d+\.\s*/i, '')
        .split(/\s*The Pattern,/i)[0]
        .split(/\s*Read the full edition/i)[0]
    ).replace(/\s+/g, ' ').trim();
    const date = pubDate ? fmt(pubDate, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    const inner =
      `> 📡 **Today's culture signal** · Pulse ${pulse || '?'}/100\n` +
      `> *${headline}* ${insight}\n` +
      `> → [The Pattern, No. ${edition || ''} · ${date}](${editionUrl})`;
    console.log(`Pattern: No.${edition} Pulse ${pulse}`);
    return replaceBlock(content, 'PATTERN', inner);
  } catch (err) {
    console.error(`Pattern skipped: ${err.message}`);
    return content;
  }
}

async function refreshWriting(content) {
  try {
    const res = await fetch('https://mikelitman.me/feed.xml', UA);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => {
      const b = m[1];
      return {
        title: pick(b, /<title>([\s\S]*?)<\/title>/i) || '',
        link: pick(b, /<link>([\s\S]*?)<\/link>/i) || '',
        date: pick(b, /<pubDate>([\s\S]*?)<\/pubDate>/i) || '',
      };
    }).filter((i) => i.title && i.link && i.date);
    if (!items.length) throw new Error('no items');

    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    const top = items.slice(0, 3).map((i) =>
      `- [${humanize(i.title)}](${i.link}) · ${fmt(i.date, { day: 'numeric', month: 'short', year: 'numeric' })}`
    );
    console.log(`Writing: ${items.length} posts, top "${humanize(items[0].title)}"`);
    return replaceBlock(content, 'WRITING', top.join('\n'));
  } catch (err) {
    console.error(`Writing skipped: ${err.message}`);
    return content;
  }
}

async function refreshMetrics(content) {
  for (const { url, re } of METRICS) {
    try {
      const res = await fetch(url, UA);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const metas = html.match(/<meta[^>]+content="[^"]*"/gi)?.join(' ') || '';
      const metric = pick(metas, re);
      if (!metric) throw new Error('metric not found');
      const tagRe = new RegExp(`(\\]\\(${esc(url)}\\) )\\([^)]*\\)`, 'g');
      if (!tagRe.test(content)) throw new Error('link tag not in README');
      content = content.replace(tagRe, `$1(${metric})`);
      console.log(`Metric ${url}: (${metric})`);
    } catch (err) {
      console.error(`Metric ${url} skipped: ${err.message}`);
    }
  }
  return content;
}

function refreshStamp(content) {
  try {
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const line =
      `🤖 *This profile maintains itself. Every morning a GitHub Action pulls the live brief ` +
      `from The Pattern, refreshes each project's numbers, and lists my latest writing, then commits ` +
      `the change. Built and run by an agent. That's the whole point.* · **Last refresh: ${today}**`;
    console.log(`Stamp: ${today}`);
    return replaceBlock(content, 'STAMP', line);
  } catch (err) {
    console.error(`Stamp skipped: ${err.message}`);
    return content;
  }
}

const before = await readFile(README, 'utf8');
let after = await refreshPattern(before);
after = await refreshWriting(after);
after = await refreshMetrics(after);
after = refreshStamp(after);

if (after === before) {
  console.log('No change.');
} else {
  await writeFile(README, after);
  console.log('README updated.');
}
