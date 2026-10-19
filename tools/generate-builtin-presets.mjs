import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { root } from "./config.mjs";

/** Share strings are the source of truth. No document constructors run during generation. */
export function generateBuiltinPresets(check = false) {
    const directory = path.join(root, "presets");
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, "catalog.json"), "utf8"));
    const strings = {}, entries = [];
    for (const [key, entry] of Object.entries(manifest)) {
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key) || ["constructor", "prototype", "__proto__"].includes(key)) throw new Error("Invalid built-in key: " + key);
        if (!["preset", "skin"].includes(entry.kind) || typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > 96) throw new Error("Invalid built-in metadata: " + key);
        if (typeof entry.file !== "string" || path.basename(entry.file) !== entry.file || !entry.file.endsWith(".luma.txt")) throw new Error("Invalid preset file: " + key);
        const value = fs.readFileSync(path.join(directory, entry.file), "utf8").trim();
        if (value.length > 262144 || !/^!LUMA:[123]![A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error("Invalid preset string: " + entry.file);
        strings[key] = value;
        entries.push({ key, name: entry.name, kind: entry.kind });
    }
    const source = "// Auto generated. Do not edit.\n// Source: presets/catalog.json and presets/*.luma.txt\n\n"
        + "export const BuiltinPresets = " + JSON.stringify(strings, null, 4) + " as const;\n\n"
        + "export const BuiltinPresetEntries = " + JSON.stringify(entries, null, 4) + " as const;\n";
    const output = path.join(root, "packages/core/src/BuiltinPresets.ts");
    const previous = fs.existsSync(output) ? fs.readFileSync(output, "utf8").replaceAll("\r\n", "\n") : undefined;
    if (check && previous !== source) throw new Error("Built-in strings changed; run npm run presets:generate.");
    if (!check && previous !== source) fs.writeFileSync(output, source);
    return entries.length;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { console.log("Built-in presets: " + generateBuiltinPresets(process.argv.includes("--check"))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
