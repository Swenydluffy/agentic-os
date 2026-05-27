/**
 * First-run setup wizard tests. Run with: `node scripts/test-setup.ts`
 *
 * Runs the wizard non-interactively against a temp config path and asserts it
 * produces a valid config.json, then confirms a re-run is idempotent (skips).
 */
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log(`  ✓ ${label}`);
}

const TSX_BIN = join(process.cwd(), "node_modules", ".bin", platform() === "win32" ? "tsx.cmd" : "tsx");

function runWizard(extraEnv: Record<string, string>): { status: number | null; stdout: string; stderr: string } {
  const res = spawnSync(TSX_BIN, ["scripts/setup.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

async function main(): Promise<void> {
  console.log("Setup wizard — first launch:");
  const dir = await mkdtemp(join(tmpdir(), "setup-test-"));
  const configPath = join(dir, "config.json");
  const vaultPath = join(dir, "MyVault");

  const env = {
    AGENTIC_OS_CONFIG_PATH: configPath,
    SETUP_NONINTERACTIVE: "1",
    SETUP_VAULT_PATH: vaultPath,
  };

  const first = runWizard(env);
  assert.equal(first.status, 0, `wizard should exit 0 (stderr: ${first.stderr})`);

  const parsed: unknown = JSON.parse(await readFile(configPath, "utf8"));
  assert.ok(typeof parsed === "object" && parsed !== null, "config.json should be an object");
  const cfg = parsed as Record<string, unknown>;
  const vault = cfg.vault as Record<string, unknown>;
  assert.equal(vault.path, vaultPath, "vault path should be the provided value");
  assert.equal(vault.folder, "Agentic OS", "default folder should be carried over");
  assert.ok(Array.isArray(cfg.agents) && cfg.agents.length === 10, "all 10 agents configured");
  assert.ok(Array.isArray(cfg.detectedTools), "detectedTools should be an array");
  const models = cfg.models as Record<string, unknown>;
  assert.ok(models && typeof models.sonnet === "string", "models should be present");
  ok("first run writes config.json (vault path, agents, models, detected tools)");

  // Detected tools should reflect reality (this repo runs where `claude` exists).
  assert.ok((cfg.detectedTools as unknown[]).every((t) => typeof t === "string"), "detectedTools are strings");
  ok("auto-detected AI agent CLIs recorded as strings");

  const second = runWizard(env);
  assert.equal(second.status, 0, "second run should exit 0");
  assert.match(second.stdout, /already complete|config\.json found/i, "re-run should skip");
  ok("re-run detects existing config and skips (idempotent)");

  await rm(dir, { recursive: true, force: true });
  console.log(`\nAll ${passed} checks passed ✓`);
}

main().catch((err) => {
  console.error("\nTEST FAILED:\n", err);
  process.exit(1);
});
