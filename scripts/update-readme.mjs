// Refreshes the live "From The Pattern" block in README.md.
// Pulls the latest dated brief and headline from https://thepattern.media
// and rewrites the content between the PATTERN markers. If the fetch
// fails for any reason, it exits without touching the README so a flaky
// network never breaks the profile.

import { readFile, writeFile } from 'node:fs/promises';

const SOURCE = 'https://thepattern.media';
const README = new URL('../README.md', import.meta.url);
const START = '<!-- PATTERN:START -->';
const END = '<!-- PATTERN:END -->';

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function pick(html, re) {
  const m = html.match(re);
  return m ? decode(m[1]) : null;
}

try {
  const res = await fetch(SOURCE, { headers: { 'user-agent': 'mikelitman-profile-bot' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // Title looks like: "The Pattern <dash> Saturday 27 June 2026"; grab the date.
  const title = pick(html, /<title>([^<]*)<\/title>/i) || '';
  const dateMatch = title.match(/(\d{1,2}\s+\w+\s+\d{4})/);
  const date = dateMatch ? dateMatch[1] : null;

  const headline =
    pick(html, /<meta[^>]+property="og:description"[^>]*content="([^"]*)"/i) ||
    pick(html, /<meta[^>]+name="description"[^>]*content="([^"]*)"/i);

  if (!headline) throw new Error('no headline found');

  const line = date
    ? `📰 **From The Pattern** · ${date}: *${headline}* → [read today's brief](${SOURCE})`
    : `📰 **From The Pattern**: *${headline}* → [read today's brief](${SOURCE})`;

  const block = `${START}\n${line}\n${END}`;
  const current = await readFile(README, 'utf8');
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (!re.test(current)) throw new Error('markers not found in README');

  const next = current.replace(re, block);
  if (next === current) {
    console.log('No change.');
  } else {
    await writeFile(README, next);
    console.log(`Updated: ${line}`);
  }
} catch (err) {
  console.error(`Skipped (source unavailable): ${err.message}`);
  process.exit(0); // never fail the build over a flaky source
}
