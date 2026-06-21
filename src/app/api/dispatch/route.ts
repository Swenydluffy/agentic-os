import { NextRequest } from "next/server";
import { loadConfig } from "@/lib/config.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";

interface WorkerTask {
  id: string;
  goal: string;
  model: string;
}

function decomposeGoal(goal: string): WorkerTask[] {
  const g = goal.toLowerCase();

  // Research + write pattern
  if ((g.includes("research") && g.includes("write")) || (g.includes("research") && g.includes("report"))) {
    return [
      { id: "w1", goal: `Research phase 1: ${goal} — Find key facts, data points, and examples.`, model: HAIKU },
      { id: "w2", goal: `Research phase 2: ${goal} — Find competitor examples and industry context.`, model: HAIKU },
      { id: "w3", goal: `Synthesis: Based on research about "${goal}", write a concise structured report with key findings and recommendations.`, model: SONNET },
    ];
  }

  // SEO / funnel pattern
  if (g.includes("seo") || g.includes("funnel") || g.includes("keyword")) {
    return [
      { id: "w1", goal: `Keyword research for: ${goal} — List 10 high-value keywords with search intent.`, model: HAIKU },
      { id: "w2", goal: `Competitor analysis for: ${goal} — Identify top 3 competitors and their content angles.`, model: HAIKU },
      { id: "w3", goal: `Content strategy for: ${goal} — Write a content brief with title, outline, and CTAs based on the keywords and competitive landscape.`, model: SONNET },
    ];
  }

  // Multiple blog posts / articles pattern
  const blogMatch = g.match(/(\d+)\s*(blog|article|post)/);
  if (blogMatch) {
    const count = Math.min(parseInt(blogMatch[1]), 3);
    const tasks: WorkerTask[] = [];
    for (let i = 0; i < count; i++) {
      tasks.push({ id: `w${i + 1}`, goal: `Write blog post ${i + 1} of ${count} for: ${goal}. Make it unique, engaging, ~400 words.`, model: SONNET });
    }
    return tasks;
  }

  // Code / build pattern
  if (g.includes("build") || g.includes("code") || g.includes("implement") || g.includes("fix")) {
    return [
      { id: "w1", goal: `Plan: ${goal} — Write a detailed technical spec and implementation steps.`, model: SONNET },
      { id: "w2", goal: `Review: ${goal} — Identify potential issues, edge cases, and risks.`, model: HAIKU },
    ];
  }

  // Default: split into 3 parallel research angles
  return [
    { id: "w1", goal: `Angle 1 — Core analysis: ${goal}`, model: HAIKU },
    { id: "w2", goal: `Angle 2 — Examples and evidence: ${goal}`, model: HAIKU },
    { id: "w3", goal: `Angle 3 — Synthesis and recommendations: ${goal}`, model: SONNET },
  ];
}

async function runWorker(
  task: WorkerTask,
  apiKey: string,
  baseUrl: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const system =
    "You are a focused worker agent. Complete exactly the task given. Be thorough but concise. Return your complete result.";

  let result = "";
  const stream = await client.messages.stream({
    model: task.model,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: task.goal }],
  });

  for await (const chunk of stream) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      result += chunk.delta.text;
      onChunk(chunk.delta.text);
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { goal?: string } | null;
  if (!body?.goal?.trim()) {
    return new Response(JSON.stringify({ error: "Missing goal" }), { status: 400 });
  }

  const config = loadConfig();
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "No API key" }), { status: 500 });
  }

  const tasks = decomposeGoal(body.goal.trim());
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function push(obj: object) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      // Announce all workers
      for (const task of tasks) {
        push({ type: "worker_start", id: task.id, goal: task.goal, model: task.model });
      }

      // Run all workers in parallel
      const startTime = Date.now();
      await Promise.all(
        tasks.map(async (task) => {
          const workerStart = Date.now();
          let result = "";
          try {
            result = await runWorker(task, apiKey, config.hermes.url, (chunk) => {
              push({ type: "worker_chunk", id: task.id, chunk });
            });
            push({
              type: "worker_done",
              id: task.id,
              result,
              elapsed: Date.now() - workerStart,
            });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            push({ type: "worker_done", id: task.id, result: `Error: ${msg}`, elapsed: Date.now() - workerStart });
          }
        })
      );

      push({ type: "dispatch_done", workers: tasks.length, elapsed: Date.now() - startTime });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
