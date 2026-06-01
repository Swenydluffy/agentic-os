import { readSecretsVault, type SecretsErrorCode } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusForCode(code?: SecretsErrorCode): number {
  switch (code) {
    case "unconfigured":
      return 500;
    case "op-missing":
      return 500;
    case "op-auth":
      return 502;
    case "op-error":
    default:
      return 502;
  }
}

/**
 * GET /api/secrets
 * Lists the Tech-Dev 1Password vault and health-checks each known provider key.
 * The response carries status booleans/labels only — secret values never leave
 * the server (see src/lib/secrets.ts).
 */
export async function GET() {
  const result = await readSecretsVault();
  return Response.json(result, { status: result.ok ? 200 : statusForCode(result.code) });
}
