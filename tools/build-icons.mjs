import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { root } from "./config.mjs";

const sourceDirectory = path.join(root, "packages/core/assets/icons/svg");
export function iconSources() {
    return fs.readdirSync(sourceDirectory).filter(name => name.endsWith(".svg")).sort().map(name => ({ name: name.slice(0, -4), svg: fs.readFileSync(path.join(sourceDirectory, name), "utf8") }));
}
export function iconManifest(sources = iconSources()) {
    const textures = Object.fromEntries(sources.map(({ name }) => [name, ["Interface", "AddOns", "LumaUI", "media", "icons", name + ".tga"].join(String.fromCharCode(92))]));
    return "// Auto generated. Do not edit.\n// Source: packages/core/assets/icons/svg/*.svg\n\nexport const IconTextures = " + JSON.stringify(textures, null, 4) + " as const;\n";
}
/** White alpha masks keep native tinting consistent and avoid premultiplied color edges. */
export function renderIcon(svg) {
    const image = new Resvg(svg, { fitTo: { mode: "width", value: 32 }, font: { loadSystemFonts: false } }).render();
    if (image.width !== 32 || image.height !== 32) throw new Error("Editor icons must have a square view box");
    const tga = Buffer.alloc(18 + 32 * 32 * 4), pixels = image.pixels;
    tga[2] = 2; tga.writeUInt16LE(32, 12); tga.writeUInt16LE(32, 14); tga[16] = 32; tga[17] = 8;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const destination = 18 + (y * 32 + x) * 4, source = ((31 - y) * 32 + x) * 4;
        tga[destination] = tga[destination + 1] = tga[destination + 2] = 255;
        tga[destination + 3] = pixels[source + 3];
    }
    return tga;
}
export function buildIconAssets() {
    const sources = iconSources(), output = path.join(root, ".generated/icons");
    fs.mkdirSync(output, { recursive: true });
    for (const { name, svg } of sources) fs.writeFileSync(path.join(output, name + ".tga"), renderIcon(svg));
    const manifestPath = path.join(root, "packages/core/src/theme/icons.ts"), manifest = iconManifest(sources);
    if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, "utf8") !== manifest) fs.writeFileSync(manifestPath, manifest);
    return output;
}
export function previewIcons() {
    const sources = iconSources(), columns = 8, width = columns * 112, height = Math.ceil(sources.length / columns) * 92 + 32;
    const content = sources.map(({ name, svg }, index) => {
        const x = (index % columns) * 112 + 56, y = Math.floor(index / columns) * 92 + 24;
        return '<g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" transform="translate(' + (x - 18) + ' ' + y + ') scale(1.5)">' + svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "") + '</g><text x="' + x + '" y="' + (y + 56) + '" text-anchor="middle" fill="#a4bdd1" font-family="Arial" font-size="11">' + name + "</text>";
    }).join("");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + " " + height + '"><rect width="100%" height="100%" fill="#101722"/>' + content + "</svg>";
    const directory = path.join(root, "artifacts"); fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "editor-icons.svg"), svg);
    fs.writeFileSync(path.join(directory, "editor-icons.png"), new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    buildIconAssets();
    if (process.argv.includes("--preview")) previewIcons();
    console.log("Built " + iconSources().length + " SVG icons for native textures.");
}
