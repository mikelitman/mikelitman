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
        required: ["id", "title", "summary", "category", "type", "why_saved", "intent", "tags", "shelf_life"],
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
