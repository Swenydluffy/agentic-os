import { NextRequest } from "next/server";
import { callNotebookTool } from "@/lib/notebook-mcp";
import {
  appendNotebookChat,
  assetTarget,
  listAssets,
  isArtifactType,
  downloadFormatFor,
} from "@/lib/notebook-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action =
  | "list"
  | "query"
  | "studio_status"
  | "studio_create"
  | "download"
  | "assets"
  | "add_source";

const ACTIONS: ReadonlySet<Action> = new Set([
  "list",
  "query",
  "studio_status",
  "studio_create",
  "download",
  "assets",
  "add_source",
]);

function isAction(v: unknown): v is Action {
  return typeof v === "string" && ACTIONS.has(v as Action);
}

interface Body {
  action?: Action;
  notebookId?: string;
  title?: string;
  query?: string;
  artifactType?: string;
  artifactId?: string;
  focusPrompt?: string;
  url?: string;
}

function ok(data: unknown) {
  return Response.json({ ok: true, data });
}

function fail(error: string, status = 200) {
  // 200 by default so the panel can render the error inline (matching /api/notebooklm).
  return Response.json({ ok: false, error }, { status });
}

/** Bridge the Notebook panel to the notebooklm-mcp singleton. One POST per action. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !isAction(body.action)) {
    return fail("Missing or unknown action.", 400);
  }

  try {
    switch (body.action) {
      case "list": {
        const payload = await callNotebookTool("notebook_list", { max_results: 100 }, 30_000);
        return ok(payload.notebooks ?? []);
      }

      case "query": {
        const notebookId = body.notebookId?.trim();
        const question = body.query?.trim();
        if (!notebookId || !question) return fail("A notebook and a question are required.", 400);

        const payload = await callNotebookTool(
          "notebook_query",
          { notebook_id: notebookId, query: question },
          130_000,
        );
        const answer = typeof payload.answer === "string" ? payload.answer : "";

        // Persist every exchange to the Obsidian vault. A vault failure must not
        // lose the answer the user already paid for, so report it without throwing.
        let savedTo: string | null = null;
        let saveError: string | null = null;
        try {
          const res = await appendNotebookChat({
            notebookId,
            title: body.title ?? "",
            question,
            answer,
          });
          savedTo = res.relativePath;
        } catch (e) {
          saveError = e instanceof Error ? e.message : String(e);
        }
        return ok({ answer, conversationId: payload.conversation_id ?? null, savedTo, saveError });
      }

      case "studio_status": {
        const notebookId = body.notebookId?.trim();
        if (!notebookId) return fail("A notebook is required.", 400);
        const payload = await callNotebookTool("studio_status", { notebook_id: notebookId }, 60_000);
        return ok(payload.artifacts ?? []);
      }

      case "studio_create": {
        const notebookId = body.notebookId?.trim();
        const artifactType = body.artifactType;
        if (!notebookId) return fail("A notebook is required.", 400);
        if (!isArtifactType(artifactType)) return fail("Unknown artifact type.", 400);

        const args: Record<string, unknown> = {
          notebook_id: notebookId,
          artifact_type: artifactType,
          confirm: true,
        };
        const focus = body.focusPrompt?.trim();
        if (focus) args.focus_prompt = focus;

        const payload = await callNotebookTool("studio_create", args, 90_000);
        return ok(payload);
      }

      case "download": {
        const notebookId = body.notebookId?.trim();
        const artifactType = body.artifactType;
        const artifactId = body.artifactId?.trim();
        if (!notebookId) return fail("A notebook is required.", 400);
        if (!isArtifactType(artifactType)) return fail("Unknown artifact type.", 400);
        if (!artifactId) return fail("An artifact id is required.", 400);

        const target = await assetTarget({
          notebookId,
          title: body.title ?? "",
          artifactType,
          artifactId,
        });

        const args: Record<string, unknown> = {
          notebook_id: notebookId,
          artifact_type: artifactType,
          artifact_id: artifactId,
          output_path: target.outputPath,
          output_format: downloadFormatFor(artifactType),
        };
        await callNotebookTool("download_artifact", args, 180_000);
        return ok({ folder: target.folder, file: target.file });
      }

      case "assets": {
        const notebookId = body.notebookId?.trim();
        if (!notebookId) return fail("A notebook is required.", 400);
        const files = await listAssets(notebookId, body.title ?? "");
        return ok(files);
      }

      case "add_source": {
        const notebookId = body.notebookId?.trim();
        const url = body.url?.trim();
        if (!notebookId) return fail("A notebook is required.", 400);
        if (!url) return fail("A source URL is required.", 400);
        if (!/^https?:\/\/\S+$/i.test(url)) {
          return fail("Enter a valid http(s) URL (website, YouTube, or Google Doc).", 400);
        }
        // wait:true so the source is ingested before the panel re-reads the count.
        const payload = await callNotebookTool(
          "source_add",
          { notebook_id: notebookId, source_type: "url", url, wait: true, wait_timeout: 90 },
          100_000,
        );
        return ok(payload);
      }
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
