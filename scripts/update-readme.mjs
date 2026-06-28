// Refreshes the live sections of README.md:
//   1) the "From The Pattern" block (latest dated brief + headline)
//   2) self-healing project metric tags, e.g. (140+ sources)
// Each source is fetched independently and wrapped in try/catch, so one
// unreachable site never breaks the others or the README.

import { readFile, writeFile } from 'node:fs/promises';

const SOURCE = 'https://thepattern.media';
const README = new URL('../README.md', import.meta.url);
const START = '<!-- PATTERN:START -->';
const END = '<!-- PATTERN:END -->';
const UA = { headers: { 'user-agent': 'mikelitman-profile-bot' } };

// Project metric tags that should track the live number on each site.
const METRICS = [
  { url: 'https://cultureterminal.com', re: /(\d[\d,]*\+?\s*sources)/i },
  { url: 'https://therelevanceindex.com', re: /(\d[\d,]*\+?\s*brands)/i },
  { url: 'https://taste-os.netlify.app', re: /(\d[\d,]*\+?\s*brands)/i },
  { url: 'https://littlelondonco.com', re: /(\d[\d,]*\+?\s*activities)/i },
];

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function pick(html, re) {
  const m = html.match(re);
  return m ? decode(m[1]) : null;
}

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function refreshPattern(content) {
  try {
    const res = await fetch(SOURCE, UA);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const title = pick(html, /<title>([^<]*)<\/title>/i) || '';
    const dateMatch = title.match(/(\d{1,2}\s+\w+\s+\d{4})/);
    const date = dateMatch ? dateMatch[1] : null;
    const headline =
      pick(html, /<meta[^>]+property="og:description"[^>]*content="([^"]*)"/i) ||
      pick(html, /<meta[^>]+name="description"[^>]*content="([^"]*)"/i);
    if (!headline) throw new Error('no headline');

    const line = date
      ? `📰 **From The Pattern** · ${date}: *${headline}* → [read today's brief](${SOURCE})`
      : `📰 **From The Pattern**: *${headline}* → [read today's brief](${SOURCE})`;

    const re = new RegExp(`${START}[\\s\\S]*?${END}`);
    if (!re.test(content)) throw new Error('markers missing');
    console.log(`Pattern: ${line}`);
    return content.replace(re, `${START}\n${line}\n${END}`);
  } catch (err) {
    console.error(`Pattern skipped: ${err.message}`);
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

const before = await readFile(README, 'utf8');
let after = await refreshPattern(before);
after = await refreshMetrics(after);

if (after === before) {
  console.log('No change.');
} else {
  await writeFile(README, after);
  console.log('README updated.');
}
