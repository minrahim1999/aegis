/**
 * RLM Progress UI extension — show live RLM REPL iteration progress in the TUI.
 *
 * The RLM core runs the prompt through a sandboxed REPL where the model writes
 * code to probe/decompose it. This extension surfaces that progress as a
 * status indicator so you can see how many iterations and sub-calls are
 * happening.
 *
 * Commands:
 *   /rlm-progress on|off   Toggle live RLM progress display
 */
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export default function rlmProgressExtension(pi: ExtensionAPI): void {
	let enabled = true;

	// Show RLM progress in the status bar during agent turns.
	pi.on("turn_start", async (_event, ctx) => {
		if (!enabled) return;
		ctx.ui.setStatus("rlm-progress", ctx.ui.theme.fg("accent", "⟳ RLM running…"));
	});

	pi.on("turn_end", async (_event, ctx) => {
		ctx.ui.setStatus("rlm-progress", undefined);
	});

	pi.registerCommand("rlm-progress", {
		description: "Toggle live RLM progress display (on|off)",
		handler: async (args, ctx: ExtensionCommandContext) => {
			const trimmed = args.trim().toLowerCase();
			if (trimmed === "on") {
				enabled = true;
				ctx.ui.notify("RLM progress display ON.", "info");
			} else if (trimmed === "off") {
				enabled = false;
				ctx.ui.setStatus("rlm-progress", undefined);
				ctx.ui.notify("RLM progress display OFF.", "info");
			} else {
				ctx.ui.notify(`RLM progress display is ${enabled ? "ON" : "OFF"}.`, "info");
			}
		},
	});
}
