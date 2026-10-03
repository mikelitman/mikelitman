#!/usr/bin/env node
// Weekly digest: every link you saved to Slack in the last 7 days, each with
// what it is and why you probably saved it, sent to you as a Slack DM.
//
//   SLACK_TOKEN=xoxp-... ANTHROPIC_API_KEY=sk-ant-... node weekly.mjs
//   node weekly.mjs --dry-run      (print the digest instead of sending it)

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { readFromApi, mergeLinks } from "./lib/slack.mjs";
import { enrichAll } from "./lib/enrich.mjs";
import { classifyLinks, summariseWeek } from "./lib/analyse.mjs";
import { buildDigest, sendDigest } from "./lib/digest.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const { values: args } = parseArgs({
  options: {
    days: { type: "string", default: "7" },
    "dry-run": { type: "boolean" },
    about: { type: "string", default: path.join(here, "about.txt") },
  },
});

function fail(msg) {
  console.error(`\n${msg}`);
  process.exit(1);
}
process.on("unhandledRejection", (err) => fail(err.message || String(err)));

const { SLACK_TOKEN, SLACK_BOT_TOKEN, ANTHROPIC_API_KEY } = process.env;
if (!SLACK_TOKEN) fail("Set SLACK_TOKEN (a Slack user token with search:read and chat:write). See README.md.");
if (!ANTHROPIC_API_KEY) fail("Set ANTHROPIC_API_KEY. See README.md.");
// ABOUT_ME lets the scheduled run use your "about" text without committing a file.
const about = process.env.ABOUT_ME || (fs.existsSync(args.about) ? fs.readFileSync(args.about, "utf8") : "");

const to = new Date();
const from = new Date(to - Number(args.days) * 86400_000);
// Slack's "after:" excludes the given day, so ask from a day earlier and trim.
const after = new Date(from - 86400_000).toISOString().slice(0, 10);
const query = `${process.env.SLACK_QUERY || "has:link from:me"} after:${after}`;

console.log(`1. Collecting links saved since ${from.toISOString().slice(0, 10)}`);
const raw = (await readFromApi(SLACK_TOKEN, { query })).filter((l) => new Date(l.savedAt) >= from);
const links = mergeLinks(raw)
  .sort((a, b) => a.savedAt.localeCompare(b.savedAt))
  .map((l, i) => ({ id: i + 1, ...l }));
console.log(`   ${links.length} links`);

let digest;
if (!links.length) {
  digest = { head: "*Your week in links* · nothing saved this week. Quiet one.", thread: [] };
} else {
  console.log("2. Reading page titles");
  await enrichAll(links);
  console.log("3. Working out what each link is and why you saved it");
  await classifyLinks(links, { about });
  console.log("4. Writing the digest");
  const analysed = links.filter((l) => l.analysis);
  const week = analysed.length
    ? await summariseWeek(analysed, { about })
    : { summary: "Claude couldn't analyse this week's links, so here they are as saved.", groups: [], nudges: [] };
  digest = buildDigest(links, week, { from, to });
}

if (args["dry-run"]) {
  console.log(`\n${digest.head}\n\n--- thread ---\n\n${digest.thread.join("\n\n---\n\n")}`);
} else {
  const sent = await sendDigest(digest, { userToken: SLACK_TOKEN, botToken: SLACK_BOT_TOKEN });
  console.log(`Sent your digest (1 message + ${sent - 1} in its thread).`);
}
