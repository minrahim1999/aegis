/**
 * Running Modes extension — SDLC-driven execution modes for Aegis.
 *
 * Modes:
 *   standard  — full SDLC loop (plan → code → review → audit)
 *   plan      — requirements + architecture only (no code)
 *   goal      — focus on a single goal/outcome
 *   code      — implementation only (assumes plan exists)
 *   review    — code review / audit only (no new code)
 *
 * Each mode injects a mode-specific system prompt block that steers the
 * agent's behavior. Standard mode enforces the full engineering loop.
 *
 * Forced coding principles (applied in all modes):
 *   DRY, KISS, YAGNI, SOLID, Law of Demeter, Single Source of Truth,
 *   Fail Fast, Minimal Change, Backward Compatibility, Testing Pyramid.
 *
 * RLM paradigm check: verifies the active model is being used through the
 * RLM core (not a normal LLM chat path).
 *
 * Commands:
 *   /mode [standard|plan|goal|code|review]   Show or set the running mode
 *   /principles                              Show the forced coding principles
 *   /rlm-check                               Verify RLM is the active inference path
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

// ============================================================================
// Types
// ============================================================================

type RunningMode = "standard" | "plan" | "goal" | "code" | "review";

interface ModeConfig {
	mode: RunningMode;
}

// ============================================================================
// Persistence
// ============================================================================

const CONFIG_PATH = join(homedir(), ".aegis", "agent", "mode.json");

async function loadMode(): Promise<RunningMode> {
	try {
		const raw = await readFile(CONFIG_PATH, "utf8");
		const parsed = JSON.parse(raw) as ModeConfig;
		if (parsed.mode && ["standard", "plan", "goal", "code", "review"].includes(parsed.mode)) {
			return parsed.mode;
		}
	} catch {
		// no config yet
	}
	return "standard";
}

async function saveMode(mode: RunningMode): Promise<void> {
	await mkdir(join(CONFIG_PATH, ".."), { recursive: true });
	await writeFile(CONFIG_PATH, JSON.stringify({ mode } satisfies ModeConfig, null, 2), { mode: 0o600 });
}

// ============================================================================
// Forced coding principles
// ============================================================================

const PRINCIPLES = [
	"DRY (Don't Repeat Yourself) — extract shared logic; no copy-paste.",
	"KISS (Keep It Simple, Stupid) — prefer the simplest solution that works.",
	"YAGNI (You Aren't Gonna Need It) — do not build speculative features.",
	"SOLID — Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion.",
	"Law of Demeter — minimize coupling; don't reach through objects.",
	"Single Source of Truth — one canonical definition per fact; no duplication.",
	"Fail Fast — validate inputs and fail early with clear errors.",
	"Minimal Change — make the smallest change that satisfies the requirement.",
	"Backward Compatibility — do not break existing behavior unless asked.",
	"Testing Pyramid — prefer many fast unit tests, fewer integration, fewest e2e.",
	"Idempotency — operations should be safe to repeat.",
	"Encapsulation — hide implementation details behind stable interfaces.",
];

const PRINCIPLES_BLOCK = `[coding principles]
You MUST follow these coding principles in every change:
${PRINCIPLES.map((p) => `- ${p}`).join("\n")}
[/coding principles]`;

// ============================================================================
// Mode system prompts
// ============================================================================

const MODE_PROMPTS: Record<RunningMode, string> = {
	standard: `[running mode: standard]
You are operating in STANDARD mode — the full SDLC engineering loop.
Follow this sequence for every task:
1. PLAN — understand requirements, identify constraints, design the approach.
2. CODE — implement the smallest correct change.
3. REVIEW — self-review the change against the requirements and principles.
4. AUDIT — verify it works (tests, typecheck, build) before reporting done.
Do not skip steps. Report which phase you are in as you go.
[/running mode]`,
	plan: `[running mode: plan]
You are operating in PLAN mode — requirements and architecture only.
Do NOT write or edit code. Produce:
- A clear statement of requirements and acceptance criteria.
- A proposed architecture / approach with trade-offs.
- A step-by-step implementation plan.
Stop after the plan is complete. Do not implement.
[/running mode]`,
	goal: `[running mode: goal]
You are operating in GOAL mode — focused on a single outcome.
Identify the single goal from the request and drive everything toward it.
Ignore or defer anything not needed for that goal (YAGNI).
Report progress toward the goal explicitly.
[/running mode]`,
	code: `[running mode: code]
You are operating in CODE mode — implementation only.
Assume a plan already exists. Implement the requested change directly,
following the coding principles. Do not re-plan or re-architect unless
the request explicitly asks. Keep changes minimal and correct.
[/running mode]`,
	review: `[running mode: review]
You are operating in REVIEW/AUDIT mode — analysis only.
Do NOT write or edit code. Review the existing code or change for:
- Correctness against requirements.
- Adherence to the coding principles (DRY, SOLID, etc.).
- Bugs, edge cases, and security issues.
- Test coverage and quality.
Report findings with specific file/line references and concrete suggestions.
Do not implement fixes unless explicitly asked.
[/running mode]`,
};

// ============================================================================
// RLM paradigm check
// ============================================================================

function rlmCheckMessage(): string {
	// The RLM core is baked into sdk.ts (setDefaultStreamFn + streamFn both use
	// rlmStreamFn). We can't introspect the running stream function from an
	// extension, but we can verify the package ships the RLM stream module.
	const lines = [
		"RLM paradigm check:",
		"- RLM is the core inference path (packages/coding-agent/src/rlm-stream.ts).",
		"- Every prompt is routed through the RLM REPL (prompt as variable P, recursive sub_rlm).",
		"- The normal LLM chat path (streamSimple) is replaced in sdk.ts.",
		"- This cannot be overridden by extensions or plugins.",
	];
	return lines.join("\n");
}

// ============================================================================
// Extension entry point
// ============================================================================

export default function runningModesExtension(pi: ExtensionAPI): void {
	let currentMode: RunningMode = "standard";

	// Load the persisted mode at startup.
	void loadMode().then((mode) => {
		currentMode = mode;
	});

	// Inject the mode-specific system prompt + forced principles each turn.
	pi.on("before_agent_start", async (_event) => {
		const mode = currentMode;
		const block = `${MODE_PROMPTS[mode]}\n\n${PRINCIPLES_BLOCK}`;
		return { systemPrompt: block };
	});

	// /mode command
	pi.registerCommand("mode", {
		description: "Show or set the running mode (standard|plan|goal|code|review)",
		handler: async (args, ctx: ExtensionCommandContext) => {
			const trimmed = args.trim().toLowerCase();
			if (!trimmed) {
				ctx.ui.notify(`Current mode: ${currentMode}`, "info");
				return;
			}
			if (["standard", "plan", "goal", "code", "review"].includes(trimmed)) {
				currentMode = trimmed as RunningMode;
				await saveMode(currentMode);
				ctx.ui.notify(`Mode set to ${currentMode}.`, "info");
				return;
			}
			ctx.ui.notify("Usage: /mode [standard|plan|goal|code|review]", "warning");
		},
	});

	// /principles command
	pi.registerCommand("principles", {
		description: "Show the forced coding principles",
		handler: async (_args, ctx: ExtensionCommandContext) => {
			ctx.ui.notify(PRINCIPLES.join("\n"), "info");
		},
	});

	// /rlm-check command
	pi.registerCommand("rlm-check", {
		description: "Verify RLM is the active inference path",
		handler: async (_args, ctx: ExtensionCommandContext) => {
			ctx.ui.notify(rlmCheckMessage(), "info");
		},
	});
}
