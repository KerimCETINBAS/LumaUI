import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = fileURLToPath(new URL("../", import.meta.url));
export const addons = [
    { directory: "addons/core", name: "LumaUI" },
    { directory: "addons/editor", name: "LumaUI_Editor" },
];
export function addonConfig(name) {
    const outputRoot = path.resolve(root, process.env.LUMAUI_OUTPUT_ROOT || "dist");
    return { name, outDir: path.join(outputRoot, name) };
}
