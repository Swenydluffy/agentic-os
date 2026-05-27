/**
 * Vault persistence tests. Run with: `node scripts/test-vault.ts`
 *
 * Layer 1 — isolated: writes into a temp dir and asserts file naming,
 *           frontmatter, tags, timestamps, chat append + goal/journal replace.
 * Layer 2 — real vault: writes one self-test chat into the configured vault
 *           (from config.json, else a temp fallback), verifies, then cleans up.
 */
import { readFile, rm, mkdtemp, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import {
  writeVaultEntry,
  writeGuide,
  parseVaultEntry,
  localDateStamp,
  type VaultParseError,
} from "../src/lib/vault.ts";

const FOLDER = "Agentic OS";

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log(`  ✓ ${label}`);
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function isolatedTests(): Promise<void> {
  console.log("Layer 1 — isolated (temp dir):");
  const root = await mkdtemp(join(tmpdir(), "vault-test-"));

  const ts1 = new Date(2026, 4, 27, 10, 15, 30).getTime();
  const ts2 = new Date(2026, 4, 27, 14, 0, 5).getTime();
  const dateStamp = localDateStamp(new Date(ts1));

  // --- chat: first write creates the file ---
  const r1 = await writeVaultEntry(
    {
      type: "chat",
      agentName: "Coder",
      userMessage: "Write a binary search.",
      assistantMessage: "Here is a tidy implementation.",
      timestamp: ts1,
    },
    root,
    FOLDER,
  );
  assert.equal(r1.created, true, "first chat write should create the file");
  assert.equal(
    r1.relativePath,
    join(FOLDER, "Chats", `Coder - ${dateStamp}.md`),
    `unexpected relative path: ${r1.relativePath}`,
  );
  assert.ok(await exists(r1.path), "chat file should exist on disk");
  ok("creates Agentic OS/Chats/<agent> - <date>.md");

  // --- chat: second write appends to the same daily file ---
  const r2 = await writeVaultEntry(
    {
      type: "chat",
      agentName: "Coder",
      userMessage: "Now add tests.",
      assistantMessage: "Added three edge-case tests.",
      timestamp: ts2,
    },
    root,
    FOLDER,
  );
  assert.equal(r2.created, false, "second same-day write must append, not recreate");
  assert.equal(r2.path, r1.path, "same agent + day must resolve to the same file");
  ok("appends to the existing daily file (one file per day per agent)");

  const content = await readFile(r1.path, "utf8");
  assert.ok(content.startsWith("---\n"), "file should open with YAML frontmatter");
  assert.equal(
    content.split("\n---\n").length,
    2,
    "frontmatter delimiters should appear exactly once (no duplicate header)",
  );
  assert.equal((content.match(/^type: chat$/gm) ?? []).length, 1, "header should be written only once");
  ok("frontmatter + title written exactly once");

  for (const tag of ["agentic-os", "chat", "coder"]) {
    assert.ok(new RegExp(`^\\s*-\\s*${tag}$`, "m").test(content), `missing tag: ${tag}`);
  }
  ok("tags present: agentic-os, chat, coder");

  assert.ok(content.includes("## 10:15:30"), "first exchange timestamp missing");
  assert.ok(content.includes("## 14:00:05"), "second exchange timestamp missing");
  assert.ok(content.includes("**You:** Write a binary search."), "user msg 1 missing");
  assert.ok(content.includes("**Coder:** Here is a tidy implementation."), "assistant msg 1 missing");
  assert.ok(content.includes("**You:** Now add tests."), "user msg 2 missing");
  ok("both exchanges saved with timestamps");

  // --- goal: checkbox task list, replace semantics ---
  const goal1 = await writeVaultEntry(
    {
      type: "goal",
      goals: [
        { text: "Ship vault sync", done: true },
        { text: "Build the Goals page", done: false },
      ],
      timestamp: ts1,
    },
    root,
    FOLDER,
  );
  assert.equal(goal1.relativePath, join(FOLDER, "Goals", `Goals - ${dateStamp}.md`), "goal path");
  assert.equal(goal1.created, true, "first goal write should create the file");
  let goalContent = await readFile(goal1.path, "utf8");
  assert.ok(/^\s*-\s*goal$/m.test(goalContent), "goal tag missing");
  assert.ok(goalContent.includes("- [x] Ship vault sync"), "checked goal missing");
  assert.ok(goalContent.includes("- [ ] Build the Goals page"), "unchecked goal missing");
  ok("goals render as a checkbox task list (#agentic-os #goal)");

  const goal2 = await writeVaultEntry(
    { type: "goal", goals: [{ text: "Only goal now", done: false }], timestamp: ts2 },
    root,
    FOLDER,
  );
  assert.equal(goal2.created, false, "second goal write should replace, not recreate");
  goalContent = await readFile(goal2.path, "utf8");
  assert.ok(goalContent.includes("- [ ] Only goal now"), "new goal missing");
  assert.ok(!goalContent.includes("Ship vault sync"), "old goals must be replaced, not appended");
  assert.equal((goalContent.match(/^type: goal$/gm) ?? []).length, 1, "exactly one header after replace");
  ok("goal file reflects current state (replace, no duplication)");

  // --- journal: one editable file per day, replace semantics ---
  const j1 = await writeVaultEntry(
    { type: "journal", body: "First draft of the day.", timestamp: ts1 },
    root,
    FOLDER,
  );
  assert.equal(j1.relativePath, join(FOLDER, "Journal", `Journal - ${dateStamp}.md`), "journal path");
  let journalContent = await readFile(j1.path, "utf8");
  assert.ok(/^\s*-\s*journal$/m.test(journalContent), "journal tag missing");
  assert.ok(journalContent.includes("First draft of the day."), "journal body missing");

  const j2 = await writeVaultEntry(
    { type: "journal", body: "Edited entry — final version.", timestamp: ts2 },
    root,
    FOLDER,
  );
  assert.equal(j2.path, j1.path, "same day must resolve to the same journal file");
  journalContent = await readFile(j2.path, "utf8");
  assert.ok(journalContent.includes("Edited entry — final version."), "edited body missing");
  assert.ok(!journalContent.includes("First draft of the day."), "old body must be replaced");
  ok("journal writes one editable file per day (replace)");

  // --- guide: written to Agentic OS/Guide.md, covers every feature ---
  const guideSource = await readFile(join(process.cwd(), "src", "content", "guide.md"), "utf8");
  const guide = await writeGuide(guideSource, root, FOLDER);
  assert.equal(guide.relativePath, join(FOLDER, "Guide.md"), "guide path");
  const guideContent = await readFile(guide.path, "utf8");
  assert.ok(/^\s*-\s*guide$/m.test(guideContent), "guide tag missing");
  assert.ok(guideContent.includes("# 🚀 Build Your Own Agentic OS"), "guide title missing");
  for (const topic of ["Dashboard", "Voice", "Obsidian", "Goals", "Journal", "Portable"]) {
    assert.ok(new RegExp(topic, "i").test(guideContent), `guide should cover: ${topic}`);
  }
  ok("guide writes to Agentic OS/Guide.md and covers all features");

  // --- input validation at the boundary ---
  assert.ok("error" in (parseVaultEntry(null) as VaultParseError), "null should be rejected");
  assert.ok("error" in (parseVaultEntry({ type: "chat" }) as VaultParseError), "missing chat fields rejected");
  assert.ok("error" in (parseVaultEntry({ type: "goal" }) as VaultParseError), "goal without goals array rejected");
  assert.ok("error" in (parseVaultEntry({ type: "journal" }) as VaultParseError), "journal without body rejected");
  assert.ok("error" in (parseVaultEntry({ type: "nope" }) as VaultParseError), "unknown type rejected");
  assert.ok(!("error" in parseVaultEntry({ type: "goal", goals: [{ text: "x", done: true }] })), "valid goal accepted");
  assert.ok(!("error" in parseVaultEntry({ type: "journal", body: "hi" })), "valid journal accepted");
  ok("parseVaultEntry validates untrusted input");

  await rm(root, { recursive: true, force: true });
}

/** Read ./config.json to discover the configured vault, if it exists. */
async function readConfiguredVault(): Promise<{ root: string; folder: string } | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(process.cwd(), "config.json"), "utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const vault = (parsed as Record<string, unknown>).vault;
    if (typeof vault !== "object" || vault === null) return null;
    const v = vault as Record<string, unknown>;
    if (typeof v.path !== "string" || v.path.trim().length === 0) return null;
    return { root: v.path, folder: typeof v.folder === "string" ? v.folder : FOLDER };
  } catch {
    return null;
  }
}

async function realVaultTest(): Promise<void> {
  const configured = await readConfiguredVault();
  const target = configured ?? { root: await mkdtemp(join(tmpdir(), "vault-real-")), folder: FOLDER };
  const note = configured ? target.root : `${target.root} (temp fallback — no config.json)`;
  console.log(`Layer 2 — configured vault (${note}):`);

  const marker = `VaultSelfTest-${Date.now()}`;
  const result = await writeVaultEntry(
    {
      type: "chat",
      agentName: marker,
      userMessage: "Self-test: does this reach the vault?",
      assistantMessage: "Confirmed — written to the Agentic OS folder.",
    },
    target.root,
    target.folder,
  );

  try {
    assert.ok(await exists(result.path), "vault file should exist");
    const content = await readFile(result.path, "utf8");
    assert.ok(content.includes("Confirmed — written to the Agentic OS folder."), "content missing");
    assert.ok(/^\s*-\s*agentic-os$/m.test(content), "agentic-os tag missing");
    ok(`real write verified at ${result.relativePath}`);
  } finally {
    await rm(result.path, { force: true }); // remove only the self-test artifact
  }
  assert.ok(!(await exists(result.path)), "self-test artifact should be cleaned up");
  ok("self-test artifact removed (vault left clean)");
}

async function main(): Promise<void> {
  await isolatedTests();
  await realVaultTest();
  console.log(`\nAll ${passed} checks passed ✓`);
}

main().catch((err) => {
  console.error("\nTEST FAILED:\n", err);
  process.exit(1);
});
