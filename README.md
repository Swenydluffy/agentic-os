# Agentic OS — Claude Mission Control

A local "mission control" dashboard for a fleet of AI agents. Chat with each
agent, track **Goals**, and keep a daily **Journal** — and every chat, goal, and
journal entry is saved automatically to your [Obsidian](https://obsidian.md)
vault as Markdown.

## Quick start

```bash
git clone <your-repo-url>
cd claude-mission-control
npm install && npm run dev
```

On first launch a **setup wizard** runs automatically (no config yet), then the
app starts at [http://localhost:3000](http://localhost:3000).

The wizard:

1. **Auto-detects installed AI agent CLIs** on your `PATH` (Claude Code, Gemini,
   Ollama, Cursor, Codex, Aider, …).
2. **Finds your Obsidian vault(s)** from Obsidian's own config and offers the
   most recently opened one as the default.
3. **Asks for the vault path** (press Enter to accept the detected default) and,
   optionally, your Anthropic API key.
4. Writes a **`config.json`** (gitignored — never committed).

It works out of the box with sensible defaults: if you skip every prompt, the
vault falls back to `~/Documents` and the app runs in demo mode without an API
key. Re-run the wizard any time with `npm run setup`.

## Configuration

All machine-specific values live in **`config.json`** at the project root. It's
gitignored; `config.example.json` is the committed template. Edit `config.json`
by hand or re-run `npm run setup`.

```jsonc
{
  "vault": {
    "path": "/Users/you/Documents/MyVault", // Obsidian vault root
    "folder": "Agentic OS"                   // subfolder the app writes into
  },
  "models": { "opus": "claude-opus-4-7", "sonnet": "claude-sonnet-4-6", "haiku": "claude-haiku-4-5-20251001" },
  "agents": [ { "id": "coder", "name": "Coder", "model": "claude-sonnet-4-6", "enabled": true } ],
  "detectedTools": ["claude"]
}
```

### API key

The Anthropic API key lives in **`.env.local`** (gitignored), which Next.js
loads automatically. Without it, the app runs in a friendly demo mode.

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

### Environment overrides

These take precedence over `config.json` (handy for CI or one-offs):

| Variable                  | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `OBSIDIAN_VAULT_PATH`     | Override the vault root path                        |
| `AGENTIC_OS_FOLDER`       | Override the in-vault subfolder (default `Agentic OS`) |
| `AGENTIC_OS_CONFIG_PATH`  | Use a config file at a non-default location         |
| `ANTHROPIC_API_KEY`       | Anthropic API key (usually set in `.env.local`)     |

## How saving works

Everything is written under `<vault>/<folder>/`:

| Type        | Location & file                                   | Behaviour                                  | Tags                       |
| ----------- | ------------------------------------------------- | ------------------------------------------ | -------------------------- |
| **Chats**   | `Chats/<Agent> - YYYY-MM-DD.md`                   | One file per day per agent; appends each exchange | `#agentic-os #chat <agent>` |
| **Goals**   | `Goals/Goals - YYYY-MM-DD.md`                     | Markdown checkbox task list, kept in sync  | `#agentic-os #goal`        |
| **Journal** | `Journal/Journal - YYYY-MM-DD.md`                 | One editable entry per day                 | `#agentic-os #journal`     |

The folder is created automatically if it doesn't exist.

## Scripts

| Command          | What it does                                              |
| ---------------- | -------------------------------------------------------- |
| `npm run dev`    | Run the setup wizard if needed, then start the dev server |
| `npm run setup`  | (Re-)run the setup wizard                                 |
| `npm run build`  | Production build                                          |
| `npm start`      | Run the production build (also runs setup if needed)      |
| `npm test`       | Vault + setup-wizard test suites                          |

## Requirements

- **Node.js 18+** (the TypeScript setup wizard and tests run via `tsx`, installed automatically)
- An Obsidian vault (optional — defaults to `~/Documents` if you don't have one)
- An Anthropic API key (optional — demo mode works without one)

## Project layout

```
src/
  app/
    api/chat/      Streaming chat endpoint
    api/vault/     Saves chats/goals/journal to the vault
    api/config/    Exposes the resolved configuration
  components/      Dashboard UI (AgentChat, GoalsPanel, JournalPanel, …)
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
