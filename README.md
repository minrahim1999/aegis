<p align="center">
  <a href="https://github.com/minrahim1999/aegis">
    <img alt="Aegis" src="https://img.shields.io/badge/Aegis-AI%20Agent-cyan?style=for-the-badge" width="200">
  </a>
</p>
<p align="center">
  <a href="https://github.com/minrahim1999/aegis"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-minrahim1999%2Faegis-181717?style=flat-square&logo=github" /></a>
  <a href="https://www.npmjs.com/package/aegis-harness"><img alt="npm" src="https://img.shields.io/npm/v/aegis-harness?style=flat-square" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" /></a>
</p>

# Aegis

**Aegis** is a personal AI agent harness built on top of [pi](https://github.com/earendil-works/pi). It keeps pi's minimal, extensible terminal coding harness and adds a set of agent features ported from [Athena Agent](https://github.com/minrahim1999/athena-agent):

- **Recursive Language Models (RLM) as the core** — every prompt is routed through the RLM inference paradigm (arXiv:2512.24601) where the prompt lives as a variable in a sandboxed REPL. This is baked into the agent core and cannot be overridden.
- **Hermes-style memory & skills** — persistent `MEMORY.md` facts injected into the system prompt, plus auto-generated skills.
- **Messaging gateway** — connect Aegis to Telegram, Discord, Slack, WhatsApp, and Matrix as a headless bot.
- **Permissions & effort** — access control for tool execution and a compute dial.
- **Running modes** — SDLC-driven modes (standard/plan/goal/code/review) with forced coding principles (DRY, SOLID, etc.) and an RLM paradigm check.
- **Session export/import** — with optional AES-256-GCM encryption.

The binary is `aegis` and the config directory is `~/.aegis/agent/`.

---

## Quick Start

**Option A — install from npm (recommended):**

```bash
npm install -g aegis-harness

# Run Aegis (interactive TUI)
aegis
```

**Option B — from source:**

```bash
# Build from source
npm install --ignore-scripts
npm run build

# Run Aegis (interactive TUI)
aegis

# Or via the binary
node packages/coding-agent/dist/cli.js
```

Aegis runs in the same modes as pi: interactive TUI, print/JSON, RPC, and an SDK for embedding.

---

## Aegis Features

### Recursive Language Models (RLM) — the core

**RLM is the core inference path of Aegis.** Every prompt you send is routed through the RLM paradigm (arXiv:2512.24601), not a normal LLM chat. The prompt lives as a variable `P` in a sandboxed `node:vm` REPL; the model writes code to probe/decompose it and recursively call itself over snippets. Only constant-size metadata + truncated stdout enter the context, so prompts far beyond the context window work.

This is baked into the agent core (`packages/agent/src/rlm-stream.ts` + `sdk.ts`), so it **cannot be overridden or bypassed** by extensions or plugins.

The RLM extension also exposes explicit variants:

```bash
/rlm "What is 15 * 7 + 3?"
/rlm --srlm "Summarize this document"
/rlm --chained 3 "Solve this problem"
```

- **RLM** — Algorithm 1: prompt as REPL variable, recursive `sub_rlm`, `Final` protocol.
- **SRLM** — self-reflective program search (arXiv:2603.15653): samples N candidate programs, scores by execution success + confidence + self-consistency.
- **Chained-RLM** — fresh-context roots with blackboard handoff (arXiv:2608.05124), majority-vote final.

### Memory & Skills

Hermes-style persistent memory. Facts are stored in `~/.aegis/agent/memory/MEMORY.md` and injected into the system prompt each turn.

| Tool | Description |
|---|---|
| `memory_read` | Read persistent facts about the user |
| `memory_write` | Append a persistent fact |
| `memory_search` | Search memory for a topic |
| `skill_create` | Auto-generate a reusable SKILL.md from a workflow |

```bash
/memory add "User prefers concise responses"
/memory            # view facts
```

Generated skills land in `~/.aegis/agent/skills/generated/<name>/SKILL.md` and are discovered automatically.

### Messaging Gateway (`/gateway`)

Connect Aegis to messaging platforms as a headless bot. Each chat gets its own headless AgentSession; replies are captured and sent back. Loop protection ignores the bot's own messages.

```bash
/gateway start telegram <token>
/gateway start discord <token>
/gateway start slack <app-token> <bot-token>
/gateway start whatsapp <phone-id> <token> <verify>
/gateway start matrix <homeserver> <token> <user>
/gateway stop [channel]
/gateway status
```

Config via env vars: `AEGIS_TELEGRAM_TOKEN`, `AEGIS_DISCORD_TOKEN`, `AEGIS_SLACK_APP_TOKEN` + `AEGIS_SLACK_BOT_TOKEN`, `AEGIS_WHATSAPP_PHONE_ID` + `AEGIS_WHATSAPP_TOKEN` + `AEGIS_WHATSAPP_VERIFY`, `AEGIS_MATRIX_HOMESERVER` + `AEGIS_MATRIX_TOKEN` + `AEGIS_MATRIX_USER`.

### Permissions & Effort

Access control for tool execution and a compute dial.

```bash
/permissions [safe|auto|restricted]
/permissions rule <tool> <allow|ask|deny>
/permissions unrule <tool>
/effort <low|medium|high|xhigh|off>
/fast on|off
```

- **safe** (default) — read-only tools auto-allowed; sensitive tools (`bash`, `write`, `edit`) ask.
- **auto** — everything allowed.
- **restricted** — everything asks except explicitly allowed tools.

Effort maps to pi's thinking level: `low`→off, `medium`→medium, `high`/`xhigh`→high.

### Session Export/Import

```bash
/session export [--encrypt] [<path>]
/session import <path> [--decrypt]
/session
```

Sessions are stored as JSONL in `~/.aegis/agent/sessions/`. Export/import with optional AES-256-GCM encryption (passphrase via `AEGIS_SESSION_PASSPHRASE`).

---

## Extensions

All Aegis features are implemented as pi extensions in `packages/coding-agent/examples/extensions/`:

| Extension | Commands / Tools |
|---|---|
| `rlm/` | `/rlm`, `/rlm --srlm`, `/rlm --chained` (explicit variants; RLM itself is the core) |
| `rlm-config/` | `/rlm-config` (tune RLM core params) |
| `rlm-progress/` | `/rlm-progress` (live RLM progress in TUI) |
| `memory-skills/` | `memory_read`, `memory_write`, `memory_search`, `skill_create`, `/memory` |
| `gateway/` | `/gateway` (telegram, discord, slack, whatsapp, matrix) |
| `permissions-effort/` | `/permissions`, `/effort`, `/fast` |
| `running-modes/` | `/mode`, `/principles`, `/rlm-check` |
| `session-export/` | `/session` |
| `git-checkpoint.ts` | auto git stash checkpoints per turn |
| `todo.ts` | `todo` tool + `/todos` |
| `subagent/` | subagent delegation |
| `protected-paths.ts` | block writes to `.env`, secrets |
| `confirm-destructive.ts` | confirm before destructive commands |
| `summarize.ts` | session summarization |
| `handoff.ts` | handoff doc generation |
| `notify.ts` | desktop/terminal notifications |

Extensions are auto-discovered from `~/.aegis/agent/extensions/` (or `.aegis/extensions/` project-local) and can be hot-reloaded with `/reload`.

---

## Pi (upstream)

Aegis is built on [pi](https://github.com/earendil-works/pi), a minimal terminal coding harness. Pi is extensible via TypeScript [Extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [Skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md), [Prompt Templates](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md), and [Themes](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/themes.md). Aegis adds the agent features above on top of pi's core.

---

## Development

```bash
npm run build       # build all packages
npm run check       # lint + typecheck (biome + tsgo)
./test.sh           # run non-e2e tests
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

[MIT](LICENSE)
