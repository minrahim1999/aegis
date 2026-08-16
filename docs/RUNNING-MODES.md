# Aegis — Running Modes

Aegis provides SDLC-driven running modes that steer the agent's behavior, plus forced coding principles and an RLM paradigm check.

## Modes

| Mode | Behavior |
|---|---|
| `standard` (default) | Full SDLC loop: **plan → code → review → audit** |
| `plan` | Requirements + architecture only (no code) |
| `goal` | Single-outcome focus (YAGNI) |
| `code` | Implementation only (assumes a plan exists) |
| `review` | Code review / audit only (no new code) |

### Commands

```bash
/mode [standard|plan|goal|code|review]   # show or set the mode
```

The mode persists to `~/.aegis/agent/mode.json` and is injected into the system prompt each turn.

## Forced Coding Principles

Every turn injects these principles into the system prompt:

- **DRY** — no copy-paste; extract shared logic
- **KISS** — simplest solution that works
- **YAGNI** — no speculative features
- **SOLID** — Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
- **Law of Demeter** — minimize coupling
- **Single Source of Truth** — one canonical definition per fact
- **Fail Fast** — validate inputs, fail early
- **Minimal Change** — smallest change that satisfies the requirement
- **Backward Compatibility** — don't break existing behavior
- **Testing Pyramid** — many unit tests, fewer integration, fewest e2e
- **Idempotency** — operations safe to repeat
- **Encapsulation** — hide implementation details

```bash
/principles   # show the forced coding principles
```

## RLM Paradigm Check

Aegis uses RLM as its core inference path. The `/rlm-check` command verifies this:

```bash
/rlm-check   # verify RLM is the active inference path
```

RLM is baked into the agent core (`packages/coding-agent/src/rlm-stream.ts` + `sdk.ts`), so it cannot be overridden by extensions or plugins.
