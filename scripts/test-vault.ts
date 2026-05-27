/**
 * Vault persistence tests. Run with: `node scripts/test-vault.ts`
 *
 * Layer 1 — isolated: writes into a temp dir (via OBSIDIAN_VAULT_PATH override)
 *           and asserts file naming, frontmatter, tags, timestamps, append
 *           behaviour, and goal/journal support.
 * Layer 2 — real vault: writes one self-test chat into the actual Omi vault to
 *           prove the wired path works, verifies it, then removes the artifact.
 */
import { readFile, rm, mkdtemp, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import {
  writeVaultEntry,
  parseVaultEntry,
  localDateStamp,
  type VaultParseError,
} from "../src/lib/vault.ts";

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
  const tmp = await mkdtemp(join(tmpdir(), "vault-test-"));
  process.env.OBSIDIAN_VAULT_PATH = tmp;
  process.env.AGENTIC_OS_FOLDER = "Agentic OS";

  const ts1 = new Date(2026, 4, 27, 10, 15, 30).getTime();
  const ts2 = new Date(2026, 4, 27, 14, 0, 5).getTime();
  const dateStamp = localDateStamp(new Date(ts1));

  // --- chat: first write creates the file ---
  const r1 = await writeVaultEntry({
    type: "chat",
    agentName: "Coder",
    userMessage: "Write a binary search.",
    assistantMessage: "Here is a tidy implementation.",
    timestamp: ts1,
  });
  assert.equal(r1.created, true, "first chat write should create the file");
  assert.ok(
    r1.relativePath === join("Agentic OS", "Chats", `Coder - ${dateStamp}.md`),
    `unexpected relative path: ${r1.relativePath}`,
  );
  assert.ok(await exists(r1.path), "chat file should exist on disk");
  ok("creates Agentic OS/Chats/<agent> - <date>.md");

  // --- chat: second write appends to the same daily file ---
  const r2 = await writeVaultEntry({
    type: "chat",
    agentName: "Coder",
    userMessage: "Now add tests.",
    assistantMessage: "Added three edge-case tests.",
    timestamp: ts2,
  });
  assert.equal(r2.created, false, "second same-day write must append, not recreate");
  assert.equal(r2.path, r1.path, "same agent + day must resolve to the same file");
  ok("appends to the existing daily file (one file per day per agent)");

  const content = await readFile(r1.path, "utf8");

  // --- frontmatter written exactly once ---
  assert.ok(content.startsWith("---\n"), "file should open with YAML frontmatter");
  assert.equal(
    content.split("\n---\n").length,
    2,
    "frontmatter delimiters should appear exactly once (no duplicate header)",
  );
  assert.equal(
    (content.match(/^type: chat$/gm) ?? []).length,
    1,
    "header should be written only once",
  );
  ok("frontmatter + title written exactly once");

  // --- tags: #agentic-os #chat + agent name ---
  for (const tag of ["agentic-os", "chat", "coder"]) {
    assert.ok(
      new RegExp(`^\\s*-\\s*${tag}$`, "m").test(content),
      `missing tag: ${tag}`,
    );
  }
  ok("tags present: agentic-os, chat, coder");

  // --- timestamps + both exchanges captured ---
  assert.ok(content.includes("## 10:15:30"), "first exchange timestamp missing");
  assert.ok(content.includes("## 14:00:05"), "second exchange timestamp missing");
  assert.ok(content.includes("**You:** Write a binary search."), "user msg 1 missing");
  assert.ok(content.includes("**Coder:** Here is a tidy implementation."), "assistant msg 1 missing");
  assert.ok(content.includes("**You:** Now add tests."), "user msg 2 missing");
  ok("both exchanges saved with timestamps");

  // --- goal + journal supported ---
  const goal = await writeVaultEntry({
    type: "goal",
    title: "Ship vault sync",
    status: "in-progress",
    details: "Wire chats, then goals.",
    timestamp: ts1,
  });
  assert.ok(goal.relativePath.includes(join("Goals", `Goals - ${dateStamp}.md`)), "goal path");
  const goalContent = await readFile(goal.path, "utf8");
  assert.ok(/^\s*-\s*goal$/m.test(goalContent), "goal tag missing");
  assert.ok(goalContent.includes("Ship vault sync"), "goal title missing");
  ok("goal entries write to Agentic OS/Goals");

  const journal = await writeVaultEntry({
    type: "journal",
    body: "Made real progress on persistence today.",
    mood: "focused",
    timestamp: ts1,
  });
  assert.ok(journal.relativePath.includes(join("Journal", `Journal - ${dateStamp}.md`)), "journal path");
  const journalContent = await readFile(journal.path, "utf8");
  assert.ok(/^\s*-\s*journal$/m.test(journalContent), "journal tag missing");
  assert.ok(journalContent.includes("Made real progress"), "journal body missing");
  ok("journal entries write to Agentic OS/Journal");

  // --- input validation at the boundary ---
  assert.ok("error" in (parseVaultEntry(null) as VaultParseError), "null should be rejected");
  assert.ok("error" in (parseVaultEntry({ type: "chat" }) as VaultParseError), "missing fields rejected");
  assert.ok("error" in (parseVaultEntry({ type: "nope" }) as VaultParseError), "unknown type rejected");
  assert.ok(!("error" in parseVaultEntry({ type: "journal", body: "hi" })), "valid journal accepted");
  ok("parseVaultEntry validates untrusted input");

  await rm(tmp, { recursive: true, force: true });
}

async function realVaultTest(): Promise<void> {
  console.log("Layer 2 — real vault (/Users/lucyanne/Documents/Omi):");
  delete process.env.OBSIDIAN_VAULT_PATH; // fall back to the real default
  delete process.env.AGENTIC_OS_FOLDER;

  const marker = `VaultSelfTest-${Date.now()}`;
  const result = await writeVaultEntry({
    type: "chat",
    agentName: marker,
    userMessage: "Self-test: does this reach the vault?",
    assistantMessage: "Confirmed — written to the Agentic OS folder.",
  });

  try {
    assert.ok(result.path.includes("/Users/lucyanne/Documents/Omi/Agentic OS/Chats/"), "wrong base path");
    assert.ok(await exists(result.path), "real vault file should exist");
    const content = await readFile(result.path, "utf8");
    assert.ok(content.includes("Confirmed — written to the Agentic OS folder."), "content missing");
    assert.ok(/^\s*-\s*agentic-os$/m.test(content), "agentic-os tag missing");
    ok(`real write verified at ${result.relativePath}`);
  } finally {
    await rm(result.path, { force: true }); // clean up the self-test artifact only
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
