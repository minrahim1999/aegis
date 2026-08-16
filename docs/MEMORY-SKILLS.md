# Aegis — Memory & Skills

Aegis provides Hermes-style persistent memory and auto-generated skills as a pi extension.

## Memory

Persistent facts are stored in `~/.aegis/agent/memory/MEMORY.md` and injected into the system prompt each turn via the `before_agent_start` event.

### Tools

| Tool | Description |
|---|---|
| `memory_read` | Read persistent facts about the user |
| `memory_write` | Append a persistent fact |
| `memory_search` | Search memory for a topic |

### Command

```bash
/memory            # view facts
```

## Skills

The `skill_create` tool auto-generates a reusable Hermes-style `SKILL.md` from a workflow the user wants to repeat. Generated skills land in `~/.aegis/agent/skills/generated/<name>/SKILL.md` and are discovered automatically.

### Tool

| Tool | Description |
|---|---|
| `skill_create` | Create a reusable skill (SKILL.md) from a workflow |

### Example

```bash
# The agent calls skill_create with:
#   name: "weekly-review"
#   description: "Run a weekly review of commitments"
#   steps: "1. List commitments\n2. Check stalled work\n3. Plan next week"
```

This writes `~/.aegis/agent/skills/generated/weekly-review/SKILL.md` with the frontmatter and procedure.
