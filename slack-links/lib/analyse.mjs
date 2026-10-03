// Two passes with Claude:
//   1. Per link (in batches): what is it, what category, and why you most
//      likely saved it, judged from what you wrote and when.
//   2. Across everything: the themes, how they move over time, and which
//      links are worth going back to now.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const BETAS = ["server-side-fallback-2026-07-01"];

export const CATEGORIES = [
  "AI & tools",
  "Product & building",
  "Design & visual",
  "Brands & marketing",
  "Culture & media",
  "Fashion & retail",
  "Music & entertainment",
  "Tech & industry news",
  "Business & strategy",
  "Writing & ideas",
  "Career & work",
  "Personal & life",
  "Other",
];

const LINK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["links"],
  properties: {
    links: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "summary", "category", "type", "why_saved", "why_short", "intent", "tags", "shelf_life"],
        properties: {
          id: { type: "integer" },
          title: { type: "string", description: "Clean, human title for the link" },
          summary: { type: "string", description: "One sentence: what this actually is" },
          category: { type: "string", enum: CATEGORIES },
          type: {
            type: "string",
            enum: ["article", "tool", "product", "company", "video", "podcast", "social post", "paper", "repo", "newsletter", "shop", "other"],
          },
          why_saved: {
            type: "string",
            description: "Second person, one or two sentences: the most likely reason you saved it in that moment",
          },
          why_short: {
            type: "string",
            description: "The same reason in under 12 words, no full stop, for a one-line digest",
          },
          intent: {
            type: "string",
            enum: ["read later", "try it", "reference", "inspiration", "competitor/market", "idea for a project", "share with someone", "buy", "just interesting"],
          },
          tags: { type: "array", items: { type: "string" }, description: "2-5 short lowercase topic tags" },
          shelf_life: { type: "string", enum: ["evergreen", "timely", "probably stale"] },
        },
      },
    },
  },
};

const THEME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["portrait", "themes", "resurface", "open_loops"],
  properties: {
    portrait: {
      type: "string",
      description: "3-5 sentences, second person: what this saving habit says about what you've been chasing",
    },
    themes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "why_it_matters", "trend", "link_ids"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          why_it_matters: { type: "string", description: "What you seem to be working out through this theme" },
          trend: { type: "string", enum: ["rising", "steady", "fading", "one burst"] },
          link_ids: { type: "array", items: { type: "integer" } },
        },
      },
    },
    resurface: {
      type: "array",
      description: "5-8 links most worth revisiting now",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "reason"],
        properties: { id: { type: "integer" }, reason: { type: "string" } },
      },
    },
    open_loops: {
      type: "array",
      description: "Things you saved with clear intent (try, build, buy) that look unfinished",
      items: { type: "string" },
    },
  },
};

function client() {
  return new Anthropic();
}

async function askJson(anthropic, { system, prompt, schema, effort, maxTokens }) {
  const stream = anthropic.beta.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    betas: BETAS,
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort, format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new Error("Claude declined this batch");
  if (msg.stop_reason === "max_tokens") throw new Error("Response was cut off (max_tokens)");
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

function aboutBlock(about) {
  return about ? `\n\nAbout the person whose links these are:\n${about.trim()}` : "";
}

function describeLink(l) {
  const lines = [`[${l.id}] ${l.url}`, `saved: ${l.savedAt.slice(0, 10)} in #${l.channel}`];
  if (l.saves.length > 1) lines.push(`saved ${l.saves.length} times (${l.saves.map((s) => s.savedAt.slice(0, 10)).join(", ")})`);
  if (l.preview?.title) lines.push(`page title: ${l.preview.title}`);
  if (l.preview?.description) lines.push(`page description: ${l.preview.description}`);
  if (l.fetched?.status && l.fetched.status >= 400) lines.push(`page now returns HTTP ${l.fetched.status}`);
  const notes = [...new Set(l.saves.map((s) => s.note).filter(Boolean))];
  if (notes.length) lines.push(`what they wrote with it: ${notes.join(" | ")}`);
  if (l.context.length) lines.push(`nearby messages: ${l.context.slice(0, 4).join(" | ").slice(0, 600)}`);
  return lines.join("\n");
}

export async function classifyLinks(links, { about, batchSize = 25, concurrency = 4, onBatch } = {}) {
  const anthropic = client();
  const system =
    "You help someone make sense of years of links they dumped into Slack as bookmarks. " +
    "For each link, work out what it is and, most importantly, the most likely reason they saved it at that moment. " +
    "Use the date, the channel, anything they wrote alongside it, and what was happening in the world then. " +
    "Be specific and grounded; if the reason is a guess, make it a sensible, concrete guess rather than a generic one. " +
    "If the page couldn't be read, infer from the URL itself." +
    aboutBlock(about);

  const batches = [];
  for (let i = 0; i < links.length; i += batchSize) batches.push(links.slice(i, i + batchSize));

  let finished = 0;
  const worker = async () => {
    while (batches.length) {
      const batch = batches.shift();
      try {
        const out = await askJson(anthropic, {
          system,
          prompt: `Classify these ${batch.length} links. Return one entry per id.\n\n${batch.map(describeLink).join("\n\n")}`,
          schema: LINK_SCHEMA,
          effort: "medium",
          maxTokens: 32000,
        });
        const byId = new Map(out.links.map((a) => [a.id, a]));
        for (const l of batch) if (byId.has(l.id)) l.analysis = byId.get(l.id);
      } catch (err) {
        console.warn(`\n  Skipped a batch of ${batch.length}: ${err.message}`);
      }
      finished++;
      onBatch?.(finished);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

const WEEK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "groups", "nudges", "echoes"],
  properties: {
    summary: {
      type: "string",
      description: "2-3 sentences, second person: what this week's saving says you were thinking about",
    },
    echoes: {
      type: "array",
      description:
        "0-4 real connections between a link saved this week and one saved in earlier weeks (same idea coming back, " +
        "a question you're still chasing, a tool you saved twice). Only strong, specific ones; empty is fine",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "earlier_id", "note"],
        properties: {
          id: { type: "integer", description: "This week's link" },
          earlier_id: { type: "integer", description: "The earlier link it connects to" },
          note: { type: "string", description: "One short line on the connection" },
        },
      },
    },
    groups: {
      type: "array",
      description: "4-8 groups. Every link id appears in exactly one group",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "gist", "link_ids"],
        properties: {
          name: { type: "string" },
          gist: { type: "string", description: "One short line: what you were circling in this group" },
          link_ids: { type: "array", items: { type: "integer" } },
        },
      },
    },
    nudges: {
      type: "array",
      description: "1-3 short, concrete suggestions: links to act on, try or connect to a project this week",
      items: { type: "string" },
    },
  },
};

// Groups one week's links into specific threads (not broad categories) and
// guarantees every link lands somewhere, even if the model misses one.
export async function summariseWeek(links, { about, earlier = [] } = {}) {
  const rows = links.map((l) => {
    const a = l.analysis;
    return `[${l.id}] ${l.savedAt.slice(0, 10)} | ${a.category} | ${a.title} | ${a.intent} | why: ${a.why_saved}`;
  });
  const earlierRows = earlier.map(rawRow);
  const out = await askJson(client(), {
    system:
      "You write a weekly digest of the links someone saved to Slack this week. Group them into the specific threads of " +
      "thought they reveal, named plainly (e.g. 'Pricing a voice agent', not 'AI'). Small weeks can have fewer groups. " +
      "Write warmly and directly, in plain English, second person." +
      aboutBlock(about),
    prompt:
      `This week's ${rows.length} links:\n\n${rows.join("\n")}` +
      (earlierRows.length
        ? `\n\nFor spotting echoes only (don't group these), links saved in the weeks before (date | title | what they wrote):\n\n${earlierRows.join("\n")}`
        : ""),
    schema: WEEK_SCHEMA,
    effort: "medium",
    maxTokens: 16000,
  });
  const valid = new Set(links.map((l) => l.id));
  const seen = new Set();
  for (const g of out.groups) {
    g.link_ids = g.link_ids.filter((id) => valid.has(id) && !seen.has(id) && seen.add(id));
  }
  const missed = links.filter((l) => !seen.has(l.id)).map((l) => l.id);
  if (missed.length) out.groups.push({ name: "Everything else", gist: "Links that didn't fit a thread", link_ids: missed });
  out.groups = out.groups.filter((g) => g.link_ids.length);
  const earlierIds = new Set(earlier.map((l) => l.id));
  out.echoes = out.echoes.filter((e) => valid.has(e.id) && earlierIds.has(e.earlier_id));
  return out;
}

// A link before any AI analysis: what Slack's preview and your note say.
function rawRow(l) {
  const title = l.preview?.title || l.url;
  const notes = [...new Set(l.saves.map((s) => s.note).filter(Boolean))].join(" | ").slice(0, 200);
  return `[${l.id}] ${l.savedAt.slice(0, 10)} | ${title}${notes ? ` | ${notes}` : ""}`;
}

const MONTH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["portrait", "themes", "shifts", "resurface", "open_loops"],
  properties: {
    portrait: { type: "string", description: "3-4 sentences, second person: what this month of saving says about you" },
    themes: {
      type: "array",
      description: "5-8 specific themes across the month",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "gist", "trend", "count", "best_ids"],
        properties: {
          name: { type: "string" },
          gist: { type: "string", description: "One line: what you were working out" },
          trend: { type: "string", enum: ["new this month", "building", "steady", "fading"] },
          count: { type: "integer", description: "Roughly how many links belong to it" },
          best_ids: { type: "array", items: { type: "integer" }, description: "Up to 5 links most worth a look" },
        },
      },
    },
    shifts: {
      type: "array",
      description: "2-4 lines on how your attention moved across the weeks of the month",
      items: { type: "string" },
    },
    resurface: {
      type: "array",
      description: "5 links most worth going back to now",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "reason"],
        properties: { id: { type: "integer" }, reason: { type: "string" } },
      },
    },
    open_loops: {
      type: "array",
      description: "Up to 5 things you clearly meant to try, build or buy and never came back to",
      items: { type: "string" },
    },
  },
};

// Monthly look-back over raw links (titles + your notes), without per-link
// analysis: cheap enough to run over a whole month in one request.
export async function summariseMonth(links, { about } = {}) {
  const out = await askJson(client(), {
    system:
      "You write a monthly look-back on the links someone saved to Slack as bookmarks. Find the specific themes " +
      "(not broad categories), how their attention moved week to week, what's worth revisiting and what they meant " +
      "to act on but didn't. Write warmly and directly, in plain English, second person." +
      aboutBlock(about),
    prompt: `This month's ${links.length} links (date | title | what they wrote):\n\n${links.map(rawRow).join("\n")}`,
    schema: MONTH_SCHEMA,
    effort: "high",
    maxTokens: 32000,
  });
  const valid = new Set(links.map((l) => l.id));
  for (const t of out.themes) t.best_ids = t.best_ids.filter((id) => valid.has(id)).slice(0, 5);
  out.resurface = out.resurface.filter((r) => valid.has(r.id));
  return out;
}

export async function findThemes(links, { about } = {}) {
  const anthropic = client();
  const rows = links
    .filter((l) => l.analysis)
    .map((l) => {
      const a = l.analysis;
      return `[${l.id}] ${l.savedAt.slice(0, 7)} | ${a.category} | ${a.title} | ${a.intent} | tags: ${a.tags.join(", ")} | why: ${a.why_saved}${l.saves.length > 1 ? ` | saved ${l.saves.length}x` : ""}`;
    });
  return askJson(anthropic, {
    system:
      "You are looking across everything one person has saved to Slack as bookmarks, to find the threads that run through it. " +
      "Find 6-12 themes that are more specific and revealing than the broad categories: the actual questions, obsessions and " +
      "projects the links point to. Notice how interest moves over time, links saved more than once, and intent that never got " +
      "acted on. Write warmly and directly, in plain English, second person." +
      aboutBlock(about),
    prompt: `Today is ${new Date().toISOString().slice(0, 10)}. Here are all ${rows.length} saved links (month | category | title | intent | tags | why saved):\n\n${rows.join("\n")}`,
    schema: THEME_SCHEMA,
    effort: "high",
    maxTokens: 64000,
  });
}
