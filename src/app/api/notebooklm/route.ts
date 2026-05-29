import { NextRequest } from "next/server";
import {
  chatNotebook,
  listArtifacts,
  listNotebooks,
  listSources,
  type NlmResult,
  type NlmJson,
} from "@/lib/notebooklm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "list" | "sources" | "artifacts" | "chat";

interface RequestBody {
  action?: Action;
  notebook?: string;
  question?: string;
}

const ACTIONS: ReadonlySet<Action> = new Set(["list", "sources", "artifacts", "chat"]);

function isAction(v: unknown): v is Action {
  return typeof v === "string" && ACTIONS.has(v as Action);
}

/** Bridge the NotebookLM panel to the `nlm` CLI. One POST, dispatched by action. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as RequestBody | null;

  if (!body || !isAction(body.action)) {
    return Response.json(
      { ok: false, error: "Missing or unknown action." },
      { status: 400 },
    );
  }

  let result: NlmResult<NlmJson>;

  switch (body.action) {
    case "list":
      result = await listNotebooks();
      break;

    case "sources": {
      const notebook = body.notebook?.trim();
      if (!notebook) {
        return Response.json(
          { ok: false, error: "A notebook id is required." },
          { status: 400 },
        );
      }
      result = await listSources(notebook);
      break;
    }

    case "artifacts": {
      const notebook = body.notebook?.trim();
      if (!notebook) {
        return Response.json(
          { ok: false, error: "A notebook id is required." },
          { status: 400 },
        );
      }
      result = await listArtifacts(notebook);
      break;
    }

    case "chat": {
      const notebook = body.notebook?.trim();
      const question = body.question?.trim();
      if (!notebook || !question) {
        return Response.json(
          { ok: false, error: "Both a notebook id and a question are required." },
          { status: 400 },
        );
      }
      result = await chatNotebook(notebook, question);
      break;
    }
  }

  // Always 200 with an { ok } flag so the panel can render errors inline.
  return Response.json(result);
}
