/**
 * RLM Stream Function — the core inference path for Aegis.
 *
 * This replaces pi's normal `streamSimple` as the default StreamFn. Every
 * prompt is routed through the Recursive Language Model (RLM) paradigm
 * (arXiv:2512.24601): the prompt lives as a variable `P` in a sandboxed
 * node:vm REPL, and the model writes code to probe/decompose it and
 * recursively call itself over snippets. Only constant-size metadata +
 * truncated stdout enter the context.
 *
 * This is baked into the agent core (not an extension), so it cannot be
 * overridden or bypassed by plugins.
 */
import vm from "node:vm";
import type { StreamFn } from "@earendil-works/pi-agent-core";
import {
	type AssistantMessage,
	type Context,
	completeSimple,
	createAssistantMessageEventStream,
	type Model,
	type SimpleStreamOptions,
	type Usage,
} from "@earendil-works/pi-ai/compat";

// ============================================================================
// RLM system prompt + code extraction
// ============================================================================

const RLM_SYSTEM_PROMPT = `You are a Recursive Language Model (RLM). The user's prompt is stored in a Python-like REPL environment as the variable P (a string). You do NOT see the prompt directly — only metadata about it.

Your job: write JavaScript code that examines P, decomposes it, and builds the final answer.

CRITICAL: Respond with JavaScript code ONLY. Do NOT use <tool_call> tags, do NOT emit JSON, do NOT describe what you would do — write actual executable code.

Environment:
- P: the full prompt string (may be very long — do not print it all)
- sub_rlm(prompt): recursively invoke a language model on a snippet; returns its answer as a string. Use it inside loops to process chunks of P.
- print(x): append to stdout (truncated; keep output small)
- Final: assign the final answer to this variable to finish.

Rules:
1. First probe P: print(P.length) and P.slice(0, 200) to understand the task.
2. Decompose: use sub_rlm on slices of P (e.g., inside a for loop) for long or information-dense prompts.
3. Build the answer incrementally in variables; print small progress notes.
4. When done, set Final = <your answer> (a string). The loop stops and Final is returned.
5. Keep each code block short and correct. If a block errors, the error is shown and you can retry.
6. Never print the entire P. Never call sub_rlm more than needed.

Example:
\`\`\`
print(P.length);
const chunk = P.slice(0, 1000);
const summary = await sub_rlm("Summarize this text:\\n" + chunk);
print("chunk done");
Final = summary;
\`\`\``;

function extractCode(text: string): string {
	const fence = text.match(/```(?:js|javascript|ts|typescript)?\s*\n([\s\S]*?)```/i);
	if (fence?.[1]) return fence[1].trim();
	if (/^(const|let|var|print\(|Final\s*=|for\s*\(|while\s*\(|await\s+sub_rlm)/m.test(text.trim())) {
		return text.trim();
	}
	return "";
}

function metadataBlock(prompt: string, stdout: string, iteration: number): string {
	return [
		"[REPL state]",
		`P.length = ${prompt.length}`,
		`P.prefix = ${JSON.stringify(prompt.slice(0, 200))}`,
		`iteration = ${iteration}`,
		stdout ? `stdout:\n${stdout}` : "stdout: (empty)",
	].join("\n");
}

// ============================================================================
// Sandboxed REPL (node:vm)
// ============================================================================

interface ReplOptions {
	prompt: string;
	subRlm: (prompt: string) => Promise<string>;
	timeoutMs: number;
	maxSubCalls: number;
	maxStdoutChars: number;
}

interface ReplResult {
	stdout: string;
	finished: boolean;
	finalValue: string;
	error?: string;
}

class RlmRepl {
	private readonly options: ReplOptions;
	private readonly context: vm.Context;
	private readonly stdout: string[] = [];
	private subCalls = 0;
	private readonly sandbox: {
		P: string;
		print: (x: unknown) => void;
		sub_rlm: (p: string) => Promise<string>;
		Final: unknown;
	};

	constructor(options: ReplOptions) {
		this.options = options;
		this.sandbox = {
			P: this.options.prompt,
			print: (x: unknown) => {
				this.stdout.push(typeof x === "string" ? x : JSON.stringify(x));
			},
			sub_rlm: async (p: string) => {
				if (this.subCalls >= this.options.maxSubCalls) {
					throw new Error(`sub_rlm call limit (${this.options.maxSubCalls}) exceeded`);
				}
				this.subCalls++;
				return this.options.subRlm(String(p));
			},
			Final: undefined,
		};
		this.context = vm.createContext(this.sandbox);
	}

	async run(code: string): Promise<ReplResult> {
		const stdoutBefore = this.stdout.length;
		let finalValue = "";
		let finished = false;

		try {
			const wrapped = `(async () => {\n${code}\n})()`;
			const result = await vm.runInContext(wrapped, this.context, {
				timeout: this.options.timeoutMs,
				filename: "rlm-repl.js",
			});
			if (this.sandbox.Final !== undefined) {
				finished = true;
				finalValue =
					typeof this.sandbox.Final === "string" ? this.sandbox.Final : JSON.stringify(this.sandbox.Final);
			} else if (result !== undefined) {
				finished = true;
				finalValue = typeof result === "string" ? result : JSON.stringify(result);
			}
		} catch (err) {
			return {
				stdout: this.truncate(this.stdout.slice(stdoutBefore).join("\n")),
				finished: false,
				finalValue: "",
				error: err instanceof Error ? err.message : String(err),
			};
		}

		return {
			stdout: this.truncate(this.stdout.slice(stdoutBefore).join("\n")),
			finished,
			finalValue,
		};
	}

	private truncate(s: string): string {
		if (s.length <= this.options.maxStdoutChars) return s;
		return `${s.slice(0, this.options.maxStdoutChars)}\n...[truncated ${s.length - this.options.maxStdoutChars} chars]`;
	}
}

// ============================================================================
// RLM loop (Algorithm 1)
// ============================================================================

interface RlmOptions {
	model: Model<any>;
	maxDepth: number;
	maxIterations: number;
	timeoutMs: number;
	maxStdoutChars: number;
	maxSubCalls: number;
	options?: SimpleStreamOptions;
}

interface RlmResult {
	answer: string;
	iterations: number;
	subCalls: number;
	depth: number;
}

/** Make a single LLM call via completeSimple (the RLM sub-model). */
async function chat(
	model: Model<any>,
	messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
	options?: SimpleStreamOptions,
): Promise<string> {
	const context: Context = {
		systemPrompt: messages.find((m) => m.role === "system")?.content,
		messages: messages
			.filter((m) => m.role !== "system")
			.map((m) => ({
				role: m.role,
				content: m.content,
				timestamp: Date.now(),
			})) as Context["messages"],
	};
	// Ensure the API key is available for the sub-call. The agent loop passes
	// it in options; fall back to the model's own apiKey or a provider default.
	const apiKey = options?.apiKey ?? (model as { apiKey?: string }).apiKey;
	const result = await completeSimple(model, context, { ...options, apiKey });
	return result.content
		.filter((b) => b.type === "text")
		.map((b) => (b as { text: string }).text)
		.join("\n");
}

class Rlm {
	private readonly options: RlmOptions;

	constructor(options: RlmOptions) {
		this.options = options;
	}

	async run(prompt: string, depth = 0): Promise<RlmResult> {
		const { model, maxIterations } = this.options;
		const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
			{ role: "system", content: RLM_SYSTEM_PROMPT },
		];
		let subCalls = 0;
		let iterations = 0;
		const repl = new RlmRepl({
			prompt,
			timeoutMs: this.options.timeoutMs,
			maxStdoutChars: this.options.maxStdoutChars,
			maxSubCalls: this.options.maxSubCalls,
			subRlm: async (snippet: string) => {
				subCalls++;
				if (depth >= this.options.maxDepth) {
					return chat(model, [{ role: "user", content: snippet }], this.options.options);
				}
				const sub = await this.run(snippet, depth + 1);
				return sub.answer;
			},
		});

		while (iterations < maxIterations) {
			iterations++;
			messages.push({ role: "user", content: metadataBlock(prompt, replStdout(messages), iterations) });
			const response = await chat(model, messages, this.options.options);
			const code = extractCode(response);
			if (!code) {
				return { answer: response.trim(), iterations, subCalls, depth };
			}
			const result = await repl.run(code);
			messages.push({ role: "assistant", content: code });
			messages.push({
				role: "user",
				content: `[executed]\n${result.error ? `ERROR: ${result.error}` : result.stdout}`,
			});
			if (result.finished) {
				return { answer: result.finalValue, iterations, subCalls, depth };
			}
			// If the model produced a non-empty stdout, use it as a fallback
			// answer so the loop doesn't spin forever without setting Final.
			if (result.stdout.trim()) {
				return { answer: result.stdout.trim(), iterations, subCalls, depth };
			}
		}

		return { answer: "Reached maximum RLM iterations without setting Final.", iterations, subCalls, depth };
	}
}

function replStdout(messages: Array<{ role: string; content: string }>): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (m && m.role === "user" && m.content.startsWith("[executed]")) {
			return m.content.replace(/^\[executed\]\n/, "");
		}
	}
	return "";
}

// ============================================================================
// RLM StreamFn — the core inference path
// ============================================================================

const DEFAULTS = {
	maxDepth: 1,
	maxIterations: 5,
	timeoutMs: 30000,
	maxStdoutChars: 2000,
	maxSubCalls: 20,
};

/** Read RLM config from the env var set by the rlm-config extension. */
function readRlmConfig(): typeof DEFAULTS {
	const raw = process.env.AEGIS_RLM_CONFIG;
	if (!raw) return { ...DEFAULTS };
	try {
		const parsed = JSON.parse(raw) as Partial<typeof DEFAULTS>;
		return { ...DEFAULTS, ...parsed };
	} catch {
		return { ...DEFAULTS };
	}
}

/**
 * The RLM stream function. Replaces streamSimple as the default StreamFn.
 * Every prompt is routed through the RLM REPL.
 */
export const rlmStreamFn: StreamFn = (model, context, options) => {
	const stream = createAssistantMessageEventStream();

	// Extract the user prompt from the context.
	const userPrompt = context.messages
		.filter((m) => m.role === "user")
		.map((m) =>
			typeof m.content === "string" ? m.content : m.content.map((c) => (c.type === "text" ? c.text : "")).join(""),
		)
		.join("\n");

	void (async () => {
		try {
			const cfg = readRlmConfig();
			const rlm = new Rlm({
				model,
				maxDepth: cfg.maxDepth,
				maxIterations: cfg.maxIterations,
				timeoutMs: cfg.timeoutMs,
				maxStdoutChars: cfg.maxStdoutChars,
				maxSubCalls: cfg.maxSubCalls,
				options,
			});
			const result = await rlm.run(userPrompt || "(empty prompt)");

			const usage: Usage = {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			};

			const message: AssistantMessage = {
				role: "assistant",
				content: [{ type: "text", text: result.answer }],
				api: model.api,
				provider: model.provider,
				model: model.id,
				usage,
				stopReason: "stop",
				timestamp: Date.now(),
			};

			stream.push({ type: "start", partial: message });
			stream.push({ type: "text_start", contentIndex: 0, partial: message });
			stream.push({ type: "text_delta", contentIndex: 0, delta: result.answer, partial: message });
			stream.push({ type: "text_end", contentIndex: 0, content: result.answer, partial: message });
			stream.push({ type: "done", reason: "stop", message });
		} catch (err) {
			const errorMessage: AssistantMessage = {
				role: "assistant",
				content: [{ type: "text", text: `RLM error: ${err instanceof Error ? err.message : String(err)}` }],
				api: model.api,
				provider: model.provider,
				model: model.id,
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "error",
				errorMessage: err instanceof Error ? err.message : String(err),
				timestamp: Date.now(),
			};
			stream.push({ type: "error", reason: "error", error: errorMessage });
		}
	})();

	return stream;
};
