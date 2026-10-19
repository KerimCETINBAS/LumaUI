import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { root, addons, web } from "./config.mjs";
import { generateBuiltinPresets } from "./generate-builtin-presets.mjs";
import { buildIconAssets } from "./build-icons.mjs";
const require = createRequire(import.meta.url);
export function run(command, args, options = {}) {
    const result = spawnSync(command, args, { stdio: "inherit", ...options });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(command + " exited with status " + result.status);
}
export function buildAddons(outputRoot) {
    generateBuiltinPresets();
    const iconAssets = buildIconAssets();
    const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
    const cli = path.join(path.dirname(require.resolve("wuira/package.json")), "cli/wuira.mjs");
    for (const addon of addons) {
        run(process.execPath, [cli, "build"], { cwd: path.join(root, addon.directory), env: { ...process.env, LUMAUI_OUTPUT_ROOT: outputRoot } });
        fs.copyFileSync(path.join(root, "LICENSE"), path.join(outputRoot, addon.name, "LICENSE"));
        const toc = path.join(outputRoot, addon.name, addon.name + ".toc");
        const content = fs.readFileSync(toc, "utf8");
        if (!/^## Version: .+$/m.test(content)) throw new Error("TOC is missing its version: " + toc);
        fs.writeFileSync(toc, content.replace(/^## Version: .+$/m, "## Version: " + version));
        if (addon.name === "LumaUI") fs.cpSync(iconAssets, path.join(outputRoot, addon.name, "media/icons"), { recursive: true });
        if (addon.name === "LumaUI" && fs.existsSync(path.join(root, "presets")))
            fs.cpSync(path.join(root, "presets"), path.join(outputRoot, addon.name, "presets"), { recursive: true });
    }
}
export function buildWeb() {
    const directory = path.join(root, web.directory);
    const webRequire = createRequire(path.join(directory, "package.json"));
    const tsc = path.join(path.dirname(webRequire.resolve("typescript/package.json")), "lib/tsc.js");
    const vite = path.join(path.dirname(webRequire.resolve("vite/package.json")), "bin/vite.js");
    run(process.execPath, [tsc, "-p", "tsconfig.json", "--noEmit"], { cwd: directory });
    run(process.execPath, [vite, "build"], { cwd: directory });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const wantWeb = process.argv.includes("--web");
        const wantAddons = process.argv.includes("--addons") || process.argv.includes("--deploy") || !wantWeb;
        let outputRoot = path.resolve(root, process.env.LUMAUI_OUTPUT_ROOT || "dist");
        if (wantAddons && process.argv.includes("--deploy") && !process.env.LUMAUI_OUTPUT_ROOT) {
            const local = path.join(root, "lumaui.local.mjs");
            if (!fs.existsSync(local)) throw new Error("Copy lumaui.local.example.mjs to lumaui.local.mjs and set outputRoot.");
            const config = (await import(pathToFileURL(local).href)).default;
            if (typeof config?.outputRoot !== "string" || !config.outputRoot.trim()) throw new Error("Set outputRoot in lumaui.local.mjs.");
            outputRoot = path.resolve(root, config.outputRoot);
        }
        if (wantAddons) buildAddons(outputRoot);
        if (wantWeb) buildWeb();
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
