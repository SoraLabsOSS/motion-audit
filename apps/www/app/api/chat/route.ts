import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import type { ModelMessage, UIMessageStreamWriter } from "ai";

import { env } from "@/env";
import { plainSourceTitle } from "@/lib/plain-text";

import type { ChatUIMessage } from "../../../components/ai/search";

const TEXT_ID = "ai-search";
const CR_AT_EOL = /\r$/;

/** Kept in sync with the Cloudflare AI Search instance for Motion Audit docs. */
const systemPrompt = [
  "You are the Motion Audit documentation assistant by SoraLabs.",
  "Reply in the same language as the user.",
  "Answer strictly from the retrieved documents. Synthesize, paraphrase, and copy formulas or code snippets from the sources — do not require an exact heading match.",
  "Motion Audit is an automated performance evaluation framework and diagnostics engine for web animations, UI transitions, scroll dynamics, layout stability, and GPU memory health.",
  "Installation tooling (CLI Runner, DevTools Extension, Programmatic SDK) is currently under active development as documented on the Installation page.",
  "Attribution & epistemic boundary: Motion Audit's quantitative model is developed independently by SoraLabs. Scores and S-to-F tiers are project-defined diagnostic indicators, not universal browser constants or official W3C/Chromium/Lighthouse certifications.",
  "Do not invent packages, CLI commands, equations, metrics, or URLs that are not in the retrieved sources.",
  "Cite matching pages as markdown links using the source path (e.g. [/docs/methodology/layout](/docs/methodology/layout)).",
  "Only say you could not find it when the retrieved documents are empty or clearly about a different topic. Then suggest a better search keyword.",
  "Never output tool XML, <tool_call>, function calls, or JSON tool syntax — write a normal markdown answer.",
].join("\n");

const queryRewritePrompt = [
  "Rewrite the latest user question into a concise English search query for Motion Audit docs.",
  "Focus on core concepts: compositor architecture, layout thrashing, paint rasterization, GPU memory/VRAM, scroll dynamics, pipeline cost model, scoring algorithm, calibration, or installation tooling.",
  "Output only the search query keywords, no quotes or explanation.",
].join("\n");

interface CfSearchChunk {
  id?: string;
  item?: {
    key?: string;
    metadata?: { title?: string };
  };
}

interface CfChatChunk {
  choices?: { delta?: { content?: string | null } }[];
}

function textFromContent(content: ModelMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
}

function toCfMessages(
  messages: ModelMessage[]
): { content: string; role: string }[] {
  return [
    { content: systemPrompt, role: "system" },
    ...messages.flatMap((message) => {
      if (message.role !== "user" && message.role !== "assistant") {
        return [];
      }

      const content = textFromContent(message.content).trim();
      if (!content) {
        return [];
      }

      return [{ content, role: message.role }];
    }),
  ];
}

function docsHref(key: string): string {
  try {
    return new URL(key).pathname;
  } catch {
    return key.startsWith("/") ? key : `/${key}`;
  }
}

function parseSseBlock(block: string): { data: string; event: string } {
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(CR_AT_EOL, "");
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  return { data: dataLines.join("\n"), event };
}

async function* iterateSse(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      if (parsed.data) {
        yield parsed;
      }
    }
  }

  const tail = parseSseBlock(buffer);
  if (tail.data) {
    yield tail;
  }
}

function writeSearchSources(
  write: (part: {
    sourceId: string;
    title?: string;
    type: "source-url";
    url: string;
  }) => void,
  data: string
) {
  let chunks: unknown;
  try {
    chunks = JSON.parse(data);
  } catch {
    return;
  }

  if (!Array.isArray(chunks)) {
    return;
  }

  const seen = new Set<string>();
  for (const raw of chunks) {
    const chunk = raw as CfSearchChunk;
    const key = chunk.item?.key;
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    const url = docsHref(key);
    const title = chunk.item?.metadata?.title
      ? plainSourceTitle(chunk.item.metadata.title)
      : undefined;
    write({
      sourceId: chunk.id ?? key,
      title: title || undefined,
      type: "source-url",
      url,
    });
  }
}

function contentDelta(data: string): string | undefined {
  try {
    const chunk = JSON.parse(data) as CfChatChunk;
    return chunk.choices?.[0]?.delta?.content ?? undefined;
  } catch {
    return;
  }
}

async function pipeCfChatStream(
  writer: UIMessageStreamWriter<ChatUIMessage>,
  body: ReadableStream<Uint8Array>
) {
  writer.write({ type: "start" });
  writer.write({ type: "start-step" });

  let textStarted = false;

  for await (const event of iterateSse(body)) {
    if (event.data === "[DONE]") {
      break;
    }

    if (event.event === "chunks") {
      writeSearchSources((part) => writer.write(part), event.data);
      continue;
    }

    const delta = contentDelta(event.data);
    if (!delta) {
      continue;
    }

    if (!textStarted) {
      writer.write({ id: TEXT_ID, type: "text-start" });
      textStarted = true;
    }

    writer.write({ delta, id: TEXT_ID, type: "text-delta" });
  }

  if (textStarted) {
    writer.write({ id: TEXT_ID, type: "text-end" });
  }

  writer.write({ type: "finish-step" });
  writer.write({ type: "finish" });
}

export async function POST(req: Request) {
  const reqJson = await req.json();
  const uiMessages = (reqJson.messages ?? []) as ChatUIMessage[];
  const messages = await convertToModelMessages<ChatUIMessage>(uiMessages, {
    convertDataPart(part) {
      if (part.type === "data-client") {
        return {
          text: `[Client Context: ${JSON.stringify(part.data)}]`,
          type: "text",
        };
      }
    },
  });

  const stream = createUIMessageStream<ChatUIMessage>({
    async execute({ writer }) {
      if (!env.AI_SEARCH_CHAT_URL) {
        throw new Error(
          "Ask AI is not configured. Please set AI_SEARCH_CHAT_URL."
        );
      }
      const response = await fetch(env.AI_SEARCH_CHAT_URL, {
        body: JSON.stringify({
          ai_search_options: {
            cache: { enabled: true },
            query_rewrite: {
              enabled: true,
              rewrite_prompt: queryRewritePrompt,
            },
          },
          max_tokens: 2048,
          messages: toCfMessages(messages),
          model: "@cf/meta/llama-3.1-8b-instruct-fast",
          stream: true,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: req.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Cloudflare AI Search failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
        );
      }

      if (!response.body) {
        throw new Error("Cloudflare AI Search returned an empty body");
      }

      await pipeCfChatStream(writer, response.body);
    },
    onError(error) {
      return error instanceof Error ? error.message : "Chat failed";
    },
    originalMessages: uiMessages,
  });

  return createUIMessageStreamResponse({ stream });
}
