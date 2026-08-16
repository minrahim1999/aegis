/**
 * RLM Config extension — tune the RLM core inference parameters at runtime.
 *
 * The RLM core (packages/coding-agent/src/rlm-stream.ts) uses hardcoded
 * defaults. This extension lets you view and adjust them at runtime. The
 * values are persisted to ~/.aegis/agent/rlm-config.json and injected into
 * the RLM stream function via an env var that the core reads.
 *
 * Commands:
 *   /rlm-config                    Show current RLM config
 *   /rlm-config <key> <value>      Set a config value
 *   /rlm-config reset              Reset to defaults
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

// ============================================================================
// Config
// ============================================================================

interface RlmConfig {
	maxDepth: number;
	maxIterations: number;
	timeoutMs: number;
	maxStdoutChars: number;
	maxSubCalls: number;
}

const DEFAULTS: RlmConfig = {
	maxDepth: 1,
	maxIterations: 20,
	timeoutMs: 30000,
	maxStdoutChars: 2000,
	maxSubCalls: 20,
};

const CONFIG_PATH = join(homedir(), ".aegis", "agent", "rlm-config.json");

async function loadConfig(): Promise<RlmConfig> {
	try {
		const raw = await readFile(CONFIG_PATH, "utf8");
		const parsed = JSON.parse(raw) as Partial<RlmConfig>;
		return { ...DEFAULTS, ...parsed };
	} catch {
		return { ...DEFAULTS };
	}
}

async function saveConfig(config: RlmConfig): Promise<void> {
	await mkdir(join(CONFIG_PATH, ".."), { recursive: true });
	await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
	// Expose to the RLM core via env var (the core reads this at startup).
	process.env.AEGIS_RLM_CONFIG = JSON.stringify(config);
}

// ============================================================================
// Extension entry point
// ============================================================================

export default function rlmConfigExtension(pi: ExtensionAPI): void {
	// Load config at startup and expose to the RLM core.
	void loadConfig().then((config) => {
		process.env.AEGIS_RLM_CONFIG = JSON.stringify(config);
	});

	pi.registerCommand("rlm-config", {
		description: "View or set RLM core inference parameters",
		handler: async (args, ctx: ExtensionCommandContext) => {
			const config = await loadConfig();
			const trimmed = args.trim();

			if (!trimmed) {
				const lines = Object.entries(config)
					.map(([k, v]) => `${k}: ${v}`)
					.join("\n");
				ctx.ui.notify(`RLM config:\n${lines}`, "info");
				return;
			}

			if (trimmed === "reset") {
				await saveConfig({ ...DEFAULTS });
				ctx.ui.notify("RLM config reset to defaults.", "info");
				return;
			}

			const parts = trimmed.split(/\s+/);
			const key = parts[0] as keyof RlmConfig;
			const value = parts[1];
			if (!key || !value || !(key in DEFAULTS)) {
				ctx.ui.notify(
					"Usage: /rlm-config <maxDepth|maxIterations|timeoutMs|maxStdoutChars|maxSubCalls> <value> | reset",
					"warning",
				);
				return;
			}

			const num = Number(value);
			if (Number.isNaN(num) || num < 0) {
				ctx.ui.notify(`Invalid value: ${value}`, "warning");
				return;
			}

			config[key] = Math.round(num);
			await saveConfig(config);
			ctx.ui.notify(`RLM config set: ${key} = ${config[key]}`, "info");
		},
	});
}
