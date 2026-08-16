# Aegis — Recursive Language Models

Aegis implements the RLM inference paradigm from [arXiv:2512.24601](https://arxiv.org/abs/2512.24601) (Zhang, Kraska, Khattab — MIT CSAIL), plus two follow-up variants, as a pi extension.

## The idea

Instead of feeding a long prompt into the model's context window, the prompt lives as a **variable `P` in a sandboxed REPL**. The model writes JavaScript code to probe, decompose, and recursively call itself over snippets. Only constant-size metadata + truncated stdout enter the context — so prompts far beyond the context window work.

## Usage

```bash
/rlm "question"                  # plain RLM (Algorithm 1)
/rlm --srlm "question"           # self-reflective program search (2603.15653)
/rlm --chained 3 "question"      # fresh roots + blackboard handoff (2608.05124)
```

## The REPL environment

- `P` — the full prompt string (never enters the model context)
- `sub_rlm(prompt)` — recursively invoke the model on a snippet
- `sub_rlm_all(prompts)` — parallel sub-calls (the paper's future work)
- `print(x)` — append to stdout (truncated to metadata size)
- `Final` — assign the answer; the loop stops

Sandbox: `node:vm` blocks `require`/`process`/`fetch`. **Note: `node:vm` is not a security boundary** — same trust level as module providers.

## Variants

| Variant | Paper | What it does |
|---|---|---|
| **RLM** | 2512.24601 | Prompt as REPL variable; recursive sub-calls; `Final` protocol |
| **SRLM** | 2603.15653 | Samples N candidate programs per iteration; scores by execution success + confidence + self-consistency; picks best |
| **Chained-RLM** | 2608.05124 | Fresh-context roots; each gets the problem + a compact blackboard from predecessors; majority-vote final |

## Config

The extension uses sensible defaults (max depth 1, 20 iterations, 30s timeout, 2000 stdout chars, 20 sub-calls). These are hardcoded in `packages/coding-agent/examples/extensions/rlm/index.ts` and can be tuned there.
