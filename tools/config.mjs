import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = fileURLToPath(new URL("../", import.meta.url));
export const addons = [
    { directory: "packages/core", name: "LumaUI" },
    { directory: "packages/editor", name: "LumaUI_Editor" },
];
export const web = { directory: "packages/web", name: "luma.web" };
export function addonConfig(name) {
    const outputRoot = path.resolve(root, process.env.LUMAUI_OUTPUT_ROOT || "dist");
    return { name, outDir: path.join(outputRoot, name) };
}
