# Aegis — Permissions & Effort

Aegis provides access control for tool execution and a compute dial as a pi extension.

## Permissions

Every tool call passes through a permission gate. Three modes:

| Mode | Behavior |
|---|---|
| `safe` (default) | Read-only tools auto-allowed; **sensitive tools ask** (`bash`, `write`, `edit`) |
| `auto` | Everything allowed (trusted setups) |
| `restricted` | Everything asks except explicitly allowed tools |

Per-tool rules override the mode:

```bash
/permissions rule bash deny       # never allow bash
/permissions rule write allow     # always allow write
/permissions unrule bash          # remove a rule
```

### Commands

```bash
/permissions [safe|auto|restricted]
/permissions rule <tool> <allow|ask|deny>
/permissions unrule <tool>
```

Config is persisted to `~/.aegis/agent/permissions-effort.json`.

## Effort

One dial that controls how much compute the agent spends. Effort maps to pi's thinking level:

| Effort | Thinking level |
|---|---|
| `low` | off |
| `medium` | medium |
| `high` | high |
| `xhigh` | high |

### Commands

```bash
/effort <low|medium|high|xhigh|off>
/fast on|off
```

`/fast on` forces low effort regardless of the configured level.
