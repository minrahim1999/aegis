# Changelog

All notable changes to Aegis. Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.8] - 2026-08-16

### Added

- **Running modes** — SDLC-driven modes (`/mode`): standard (plan → code → review → audit), plan, goal, code, review. Forced coding principles (DRY, KISS, YAGNI, SOLID, Law of Demeter, Single Source of Truth, Fail Fast, Minimal Change, Backward Compatibility, Testing Pyramid, Idempotency, Encapsulation) injected each turn. `/principles` and `/rlm-check` commands.
- **RLM config** — `/rlm-config` to tune RLM core parameters at runtime (maxDepth, maxIterations, timeoutMs, maxStdoutChars, maxSubCalls), persisted to `~/.aegis/agent/rlm-config.json`.
- **RLM progress** — `/rlm-progress` to show live RLM REPL progress in the TUI status bar.

## [0.1.0] - 2026-08-16

### Added

- **Aegis** — a personal AI agent harness built on top of pi, with agent features ported from Athena Agent.
- **RLM as the core inference path** — every prompt is routed through the Recursive Language Model (RLM) REPL (arXiv:2512.24601), baked into the agent core and not overridable by extensions.
- **Hermes-style memory & skills** — `memory_read`/`memory_write`/`memory_search`/`skill_create` tools + `/memory` command; MEMORY.md facts injected into the system prompt each turn.
- **Messaging gateway** — `/gateway` connects Aegis to Telegram, Discord, Slack, WhatsApp, and Matrix as a headless bot.
- **Permissions & effort** — `/permissions` (safe/auto/restricted + per-tool rules), `/effort` (low→xhigh), and `/fast`.
- **Session export/import** — `/session export/import` with optional AES-256-GCM encryption.
- **Shell script installer** — `curl -fsSL https://raw.githubusercontent.com/minrahim1999/aegis/main/install.sh | sh`.
