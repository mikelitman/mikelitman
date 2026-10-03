#!/usr/bin/env node
// Link Archaeology: understand every link you've saved to Slack.
// See README.md for setup. Quick start:
//   node run.mjs --export ./my-slack-export      (unzipped Slack export)
//   SLACK_TOKEN=xoxp-... node run.mjs --api       (Slack API, user token)

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { readExport, readFromApi, mergeLinks } from "./lib/slack.mjs";
import { enrichAll } from "./lib/enrich.mjs";
import { classifyLinks, findThemes } from "./lib/analyse.mjs";
import { buildReport } from "./lib/report.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const { values: args } = parseArgs({
  options: {
    export: { type: "string" },
    api: { type: "boolean" },
    query: { type: "string", default: "has:link from:me" },
    user: { type: "string" },
    about: { type: "string", default: path.join(here, "about.txt") },
    "no-fetch": { type: "boolean" },
    limit: { type: "string" },
    out: { type: "string", default: path.join(here, "report.html") },
    "report-only": { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});

if (args.help || (!args.export && !args.api && !args["report-only"])) {
  console.log(`Usage:
  node run.mjs --export <folder>   Read an unzipped Slack export
  node run.mjs --api               Read via Slack API (needs SLACK_TOKEN)

Options:
  --user <U123>       Export only: just this person's messages
  --query "<q>"       API only: Slack search query (default "has:link from:me")
  --about <file>      A few lines about you, so the "why" is sharper (default about.txt)
  --limit <n>         Only analyse the n newest new links (cheap trial run)
  --no-fetch          Don't visit pages to read their titles
  --report-only       Rebuild report.html from saved results, no AI calls
  --out <file>        Where to write the report (default report.html)`);
  process.exit(0);
}

function fail(msg) {
  console.error(`\n${msg}`);
  process.exit(1);
}
process.on("unhandledRejection", (err) => fail(err.message || String(err)));

const DATA = path.join(here, "data", "links.json");
fs.mkdirSync(path.dirname(DATA), { recursive: true });
const saved = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, "utf8")) : [];
const save = (links) => fs.writeFileSync(DATA, JSON.stringify(links, null, 1));
const about = fs.existsSync(args.about) ? fs.readFileSync(args.about, "utf8") : "";

let links = saved;

if (!args["report-only"]) {
  console.log("1. Collecting links from Slack");
  let raw;
  if (args.export) {
    try {
      raw = readExport(path.resolve(args.export), { userId: args.user });
    } catch (err) {
      fail(err.message);
    }
  }
  else {
    if (!process.env.SLACK_TOKEN) fail("Set SLACK_TOKEN (a Slack user token with search:read). See README.md.");
    raw = await readFromApi(process.env.SLACK_TOKEN, { query: args.query });
  }
  const fresh = mergeLinks(raw);

  // Keep earlier analysis; add anything new. IDs stay stable across runs.
  const byUrl = new Map(saved.map((l) => [l.url, l]));
  let nextId = Math.max(0, ...saved.map((l) => l.id)) + 1;
  for (const l of fresh) {
    const old = byUrl.get(l.url);
    if (old) {
      const seen = new Set(old.saves.map((s) => s.savedAt));
      old.saves.push(...l.saves.filter((s) => !seen.has(s.savedAt)));
      old.context = [...new Set([...old.context, ...l.context])];
    } else {
      byUrl.set(l.url, { id: nextId++, ...l });
    }
  }
  links = [...byUrl.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  console.log(`   ${raw.length} link posts, ${links.length} unique links (${links.length - saved.length} new)`);
  save(links);

  let todo = links.filter((l) => !l.analysis);
  if (args.limit) todo = todo.slice(0, Number(args.limit));

  if (!args["no-fetch"]) {
    console.log("2. Reading page titles for links Slack didn't preview");
    await enrichAll(todo);
    save(links);
  }

  if (todo.length && !process.env.ANTHROPIC_API_KEY) fail("Set ANTHROPIC_API_KEY first. See README.md.");
  if (todo.length) {
    const batches = Math.ceil(todo.length / 25);
    console.log(`3. Working out what each link is and why you saved it (${todo.length} links, ${batches} batches)`);
    await classifyLinks(todo, {
      about,
      onBatch: (n) => {
        process.stdout.write(`\r   ${n}/${batches} batches`);
        save(links); // progress survives a crash or Ctrl-C
      },
    });
    process.stdout.write("\n");
  } else {
    console.log("3. Nothing new to analyse");
  }

  const analysed = links.filter((l) => l.analysis);
  if (!analysed.length) fail("No links were analysed, so there's nothing to report.");
  console.log(`4. Looking for themes across all ${analysed.length} links`);
  const themes = await findThemes(analysed, { about });
  fs.writeFileSync(path.join(here, "data", "themes.json"), JSON.stringify(themes, null, 1));
}

const themesFile = path.join(here, "data", "themes.json");
if (!fs.existsSync(themesFile)) fail("No saved results yet. Run with --export or --api first.");
fs.writeFileSync(args.out, buildReport(links, JSON.parse(fs.readFileSync(themesFile, "utf8"))));
console.log(`\nDone. Open ${path.relative(process.cwd(), args.out) || args.out} in your browser.`);
