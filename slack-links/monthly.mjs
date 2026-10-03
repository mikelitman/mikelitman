#!/usr/bin/env node
// Monthly look-back: themes across the last 30 days of links you saved to
// Slack, how your attention moved, what's worth revisiting and what you meant
// to act on. Sent as a Slack DM.
//
//   node monthly.mjs              (send it)
//   node monthly.mjs --dry-run    (print it instead)

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { collectSince, numbered } from "./lib/collect.mjs";
import { summariseMonth } from "./lib/analyse.mjs";
import { buildMonthly, sendDigest } from "./lib/digest.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const { values: args } = parseArgs({
  options: {
    days: { type: "string", default: "30" },
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
if (!SLACK_TOKEN) fail("Set SLACK_TOKEN (a Slack user token with search:read). See README.md.");
if (!ANTHROPIC_API_KEY) fail("Set ANTHROPIC_API_KEY. See README.md.");
const about = process.env.ABOUT_ME || (fs.existsSync(args.about) ? fs.readFileSync(args.about, "utf8") : "");

const to = new Date();
const from = new Date(to - Number(args.days) * 86400_000);

console.log(`1. Collecting links saved since ${from.toISOString().slice(0, 10)}`);
const links = numbered(await collectSince(SLACK_TOKEN, from, { query: process.env.SLACK_QUERY || undefined }));
console.log(`   ${links.length} links`);
if (!links.length) {
  console.log("Nothing saved this month, so no look-back.");
  process.exit(0);
}

console.log("2. Looking back across the month");
const month = await summariseMonth(links, { about });
const digest = buildMonthly(links, month, { from, to });

if (args["dry-run"]) {
  console.log(`\n${digest.head}\n\n--- thread ---\n\n${digest.thread.join("\n\n---\n\n")}`);
} else {
  const sent = await sendDigest(digest, { userToken: SLACK_TOKEN, botToken: SLACK_BOT_TOKEN });
  console.log(`Sent your monthly look-back (1 message + ${sent - 1} in its thread).`);
}
