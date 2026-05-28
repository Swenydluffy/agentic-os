/**
 * First-run setup wizard. Runs automatically before `next dev` (see the
 * `predev` script) and can be re-run with `npm run setup`.
 *
 * It auto-detects installed AI agent CLIs and Obsidian vaults, asks for the
 * vault path (with a smart default), and writes a gitignored `config.json`.
 *
 * Self-contained on purpose: it's executed directly by Node (type-stripped),
 * so it reads config.example.json from disk rather than importing app modules.
 *
 * Test/automation hooks (env):
 *   AGENTIC_OS_CONFIG_PATH  where to write config.json (default: ./config.json)
 *   SETUP_NONINTERACTIVE=1  skip prompts, accept defaults
 *   SETUP_VAULT_PATH        preset vault path (used as the default/answer)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv, env, exit, cwd } from "node:process";

interface AiTool {
  bin: string;
  label: string;
}

const AI_TOOLS: AiTool[] = [
  { bin: "claude", label: "Claude Code" },
  { bin: "gemini", label: "Gemini CLI" },
  { bin: "ollama", label: "Ollama" },
  { bin: "cursor", label: "Cursor" },
  { bin: "codex", label: "OpenAI Codex CLI" },
  { bin: "aider", label: "Aider" },
  { bin: "llm", label: "llm (Datasette)" },
  { bin: "cody", label: "Sourcegraph Cody" },
  { bin: "copilot", label: "GitHub Copilot CLI" },
  { bin: "code", label: "VS Code" },
];

const FORCE = argv.includes("--force");

function configOutputPath(): string {
  return env.AGENTIC_OS_CONFIG_PATH?.trim() || join(cwd(), "config.json");
}

function isNonInteractive(): boolean {
  return env.SETUP_NONINTERACTIVE === "1" || !stdin.isTTY;
}

/** Is `bin` an executable on the user's PATH? */
function isOnPath(bin: string): boolean {
  const PATH = env.PATH ?? "";
  const isWin = platform() === "win32";
  const sep = isWin ? ";" : ":";
  const exts = isWin ? ["", ".exe", ".cmd", ".bat"] : [""];
  for (const dir of PATH.split(sep)) {
    if (!dir) continue;
    for (const ext of exts) {
      if (existsSync(join(dir, bin + ext))) return true;
    }
  }
  return false;
}

/** Locate Obsidian's vault registry across platforms. */
function obsidianConfigPath(): string {
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "obsidian", "obsidian.json");
    case "win32":
      return join(env.APPDATA ?? join(home, "AppData", "Roaming"), "obsidian", "obsidian.json");
    default:
      return join(env.XDG_CONFIG_HOME ?? join(home, ".config"), "obsidian", "obsidian.json");
  }
}

/** Read known Obsidian vault paths, most-recently-opened first. */
function detectObsidianVaults(): string[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(obsidianConfigPath(), "utf8"));
    if (typeof parsed !== "object" || parsed === null) return [];
    const vaults = (parsed as Record<string, unknown>).vaults;
    if (typeof vaults !== "object" || vaults === null) return [];
    return Object.values(vaults as Record<string, unknown>)
      .filter((v): v is { path: string; ts?: number } => {
        return typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).path === "string";
      })
      .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
      .map((v) => v.path);
  } catch {
    return [];
  }
}

function envFileHasApiKey(): boolean {
  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim().length > 0) return true;
  try {
    const text = readFileSync(join(cwd(), ".env.local"), "utf8");
    return /^\s*ANTHROPIC_API_KEY\s*=\s*\S/m.test(text);
  } catch {
    return false;
  }
}

function appendApiKey(key: string): void {
  const path = join(cwd(), ".env.local");
  const line = `ANTHROPIC_API_KEY=${key}\n`;
  let existing = "";
  try {
    existing = readFileSync(path, "utf8");
  } catch {
    /* file may not exist yet */
  }
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  writeFileSync(path, existing + prefix + line, "utf8");
}

interface ExampleConfig {
  vault: { path: string; folder: string };
  models: Record<string, string>;
  agents: Array<{ id: string; name: string; model: string; enabled: boolean }>;
  detectedTools: string[];
}

function readExampleConfig(): ExampleConfig {
  const raw: unknown = JSON.parse(readFileSync(join(cwd(), "config.example.json"), "utf8"));
  // The committed example is trusted; a light cast keeps this script dependency-free.
  return raw as ExampleConfig;
}

async function main(): Promise<void> {
  const outPath = configOutputPath();

  if (existsSync(outPath) && !FORCE) {
    console.log("✓ config.json found — setup already complete. (Run `npm run setup` to redo.)");
    exit(0);
  }

  console.log("\n🚀 Agentic OS — first-run setup\n");

  const detected = AI_TOOLS.filter((t) => isOnPath(t.bin));
  if (detected.length > 0) {
    console.log("Detected AI agents on this machine:");
    for (const t of detected) console.log(`  • ${t.label} (${t.bin})`);
  } else {
    console.log("No known AI agent CLIs detected on PATH (that's fine — the app still runs).");
  }
  console.log("");

  const vaults = detectObsidianVaults();
  const suggested = env.SETUP_VAULT_PATH?.trim() || vaults[0] || join(homedir(), "Documents");

  let vaultPath = suggested;
  if (isNonInteractive()) {
    console.log(`Using vault path: ${vaultPath}`);
  } else {
    if (vaults.length > 0) {
      console.log("Found Obsidian vault(s):");
      for (const v of vaults) console.log(`  • ${v}`);
      console.log("");
    }
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      const answer = (await rl.question(`Obsidian vault path (${suggested}): `)).trim();
      vaultPath = answer || suggested;

      if (!envFileHasApiKey()) {
        const key = (await rl.question("Anthropic API key (optional — press Enter to skip): ")).trim();
        if (key) {
          appendApiKey(key);
          console.log("  ↳ saved to .env.local");
        }
      }
    } finally {
      rl.close();
    }
  }

  const example = readExampleConfig();
  const config = {
    vault: { path: vaultPath, folder: example.vault.folder },
    models: example.models,
    agents: example.agents,
    detectedTools: detected.map((t) => t.bin),
  };
  writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  console.log(`\n✓ Wrote ${outPath}`);
  console.log(`  Vault:  ${vaultPath}/${example.vault.folder}`);
  console.log(`  Agents: ${example.agents.length} configured`);
  console.log(`  Tools:  ${detected.length > 0 ? detected.map((t) => t.bin).join(", ") : "none detected"}`);
  console.log("\nSetup complete. Starting the app…\n");
}

main().catch((err: unknown) => {
  console.error("Setup failed:", err instanceof Error ? err.message : err);
  exit(1);
});
