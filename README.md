# 🚀 Agentic OS

**AI Agent Mission Control — with Obsidian sync, voice input, goals, and a journal.**

Agentic OS is a local "mission control" dashboard for a fleet of AI agents. Chat
with each specialist agent, track your **goals**, keep a daily **journal**, and
talk with your **voice** — and *everything* is saved automatically to your
[Obsidian](https://obsidian.md) vault as clean, tagged Markdown you own forever.

Built with Next.js + React + the Anthropic API. Runs entirely on your machine.

---

## ✨ Features

### 🪐 Agent dashboard
A cinematic command-deck UI — glass panels, neon glow, live stat tiles, and a
fleet of ten specialist agents (Orchestrator, Researcher, Architect, Coder,
Reviewer, Tester, Sentinel, Ops, Memoria, Scout). Open any agent and chat with
it; responses stream in live.

### 🎙️ Voice input
A microphone button next to every composer uses your browser's built-in speech
recognition to dictate messages — no extra API key, no setup. It politely hides
itself on browsers that don't support it.

### 🗂️ Obsidian sync (chats)
Every message exchange is saved to your vault automatically — **one Markdown
file per day per agent**, appended as you go, with timestamps and
`#agentic-os #chat <agent>` tags. Your AI conversations become searchable,
linkable notes instead of vanishing.

### ✅ Goals
Add, edit, and check off goals. They're written to your vault as a real Markdown
**checkbox task list** (`- [ ]` / `- [x]`) that stays in sync — so your goals
appear as tickable checkboxes inside Obsidian too. Voice input included.

### 📓 Journal
A calm daily journaling page. Write freely; it auto-saves **one editable file
per day** to your vault. Voice input included.

### 📖 In-app Guide
A built-in, beautifully rendered guide that teaches anyone to build this whole
system with Claude — and it's saved to your vault as `Guide.md` too.

### 📦 Portable & shareable
A first-run **setup wizard** auto-detects your installed AI tools and Obsidian
vault, then writes a per-machine `config.json`. No hardcoded paths — clone it and
run with a single command.

---

## ⚡ Quick start

```bash
git clone https://github.com/Swenydluffy/agentic-os.git
cd agentic-os
npm install && npm run dev
```

On first launch a **setup wizard** runs automatically, then the app opens at
[http://localhost:3000](http://localhost:3000).

The wizard:

1. **Auto-detects installed AI agent CLIs** on your `PATH` (Claude Code, Gemini,
   Ollama, Cursor, Codex, Aider, …).
2. **Finds your Obsidian vault(s)** from Obsidian's own config and offers the
   most recently opened one as the default.
3. **Asks for the vault path** (press Enter to accept the detected default) and,
   optionally, your Anthropic API key.
4. Writes a **`config.json`** (gitignored — never committed).

It works out of the box: skip every prompt and the vault falls back to
`~/Documents` and the app runs in a friendly demo mode without an API key.
Re-run the wizard any time with `npm run setup`.

---

## 🔧 Set it up for your computer

### Vault path & config

All machine-specific values live in **`config.json`** at the project root
(gitignored). `config.example.json` is the committed template. Let the wizard
write it, edit it by hand, or run `npm run setup` again.

```jsonc
{
  "vault": {
    "path": "/Users/you/Documents/MyVault", // your Obsidian vault root
    "folder": "Agentic OS"                   // subfolder the app writes into
  },
  "models": { "opus": "claude-opus-4-7", "sonnet": "claude-sonnet-4-6", "haiku": "claude-haiku-4-5-20251001" },
  "agents": [ { "id": "coder", "name": "Coder", "model": "claude-sonnet-4-6", "enabled": true } ],
  "detectedTools": ["claude"]
}
```

### API key

Put your Anthropic API key in **`.env.local`** (gitignored), which Next.js loads
automatically. Without it, the app still runs in demo mode.

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at [console.anthropic.com](https://console.anthropic.com/).

### Environment overrides

These take precedence over `config.json` (handy for CI or one-offs):

| Variable                 | Purpose                                                 |
| ------------------------ | ------------------------------------------------------- |
| `OBSIDIAN_VAULT_PATH`    | Override the vault root path                            |
| `AGENTIC_OS_FOLDER`      | Override the in-vault subfolder (default `Agentic OS`)  |
| `AGENTIC_OS_CONFIG_PATH` | Use a config file at a non-default location             |
| `ANTHROPIC_API_KEY`      | Anthropic API key (usually set in `.env.local`)         |

---

## 💾 How saving works

Everything is written under `<vault>/<folder>/`:

| Type        | Location & file                   | Behaviour                                         | Tags                        |
| ----------- | --------------------------------- | ------------------------------------------------- | --------------------------- |
| **Chats**   | `Chats/<Agent> - YYYY-MM-DD.md`   | One file per day per agent; appends each exchange | `#agentic-os #chat <agent>` |
| **Goals**   | `Goals/Goals - YYYY-MM-DD.md`     | Markdown checkbox task list, kept in sync         | `#agentic-os #goal`         |
| **Journal** | `Journal/Journal - YYYY-MM-DD.md` | One editable entry per day                        | `#agentic-os #journal`      |
| **Guide**   | `Guide.md`                        | The build guide, synced when you open the page    | `#agentic-os #guide`        |

The folder is created automatically if it doesn't exist.

---

## 📜 Scripts

| Command         | What it does                                              |
| --------------- | --------------------------------------------------------- |
| `npm run dev`   | Run the setup wizard if needed, then start the dev server |
| `npm run setup` | (Re-)run the setup wizard                                 |
| `npm run build` | Production build                                          |
| `npm start`     | Run the production build (also runs setup if needed)      |
| `npm test`      | Vault + setup-wizard test suites                          |

---

## ✅ Requirements

- **Node.js 18+** (the TypeScript setup wizard and tests run via `tsx`, installed automatically)
- An **Obsidian** vault (optional — defaults to `~/Documents` if you don't have one)
- An **Anthropic API key** (optional — demo mode works without one)

---

## 🗂️ Project layout

```
src/
  app/
    api/chat/      Streaming chat endpoint
    api/vault/     Saves chats/goals/journal to the vault
    api/guide/     Serves the guide and writes it to the vault
    api/config/    Exposes the resolved configuration
  components/      Dashboard UI (AgentChat, GoalsPanel, JournalPanel, GuidePanel, Markdown, …)
  content/
    guide.md       The in-app build guide
  lib/
    config.ts        Config types + defaults (client-safe)
    config.server.ts Resolves config.json + env (server-only)
    vault.ts         Markdown formatting + file writing
    agents.ts        The agent fleet
scripts/
  setup.ts         First-run setup wizard
  test-vault.ts    Vault persistence tests
  test-setup.ts    Setup-wizard tests
config.example.json  Committed config template
```

---

## 🔒 Privacy

Agentic OS runs locally. Your notes are written straight to your own Obsidian
vault on disk, and your API key stays in a gitignored `.env.local`. Nothing is
sent anywhere except the Anthropic API when you chat.

---

*Built by talking to Claude. Open the in-app **Guide** to learn how to build it yourself.* 🤖💛
