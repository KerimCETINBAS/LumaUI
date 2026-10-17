import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { root, addons } from "./config.mjs";
import { buildAddons, run } from "./build.mjs";

function releaseMetadata() {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const version = pkg.version;
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error("Invalid release version: " + version);
    const tag = process.env.RELEASE_TAG;
    if (tag && tag !== "v" + version) throw new Error("Tag " + tag + " must match package version v" + version);
    const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
    if (lock.packages[""].version !== version) throw new Error("Update package-lock.json before releasing.");
    for (const addon of addons) {
        const manifest = JSON.parse(fs.readFileSync(path.join(root, addon.directory, "package.json"), "utf8"));
        if (manifest.version !== version || lock.packages[addon.directory]?.version !== version) throw new Error("Workspace versions must match: " + addon.directory);
    }
    const lines = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8").split(/\r?\n/);
    const heading = "## [" + version + "]";
    const index = lines.findIndex(line => line === heading || line.startsWith(heading + " - "));
    if (index < 0) throw new Error("Add " + heading + " to CHANGELOG.md before releasing.");
    let end = index + 1;
    while (end < lines.length && !lines[end].startsWith("## ")) end++;
    const notes = lines.slice(index + 1, end).join("\n").trim();
    if (!notes) throw new Error("Release notes are empty.");
    return { version, notes };
}
function validateAddon(directory, name, version) {
    const license = fs.readFileSync(path.join(directory, "LICENSE"), "utf8");
    if (license !== fs.readFileSync(path.join(root, "LICENSE"), "utf8")) throw new Error("Missing or incorrect MIT license: " + name);
    const toc = fs.readFileSync(path.join(directory, name + ".toc"), "utf8");
    if (!toc.includes("## Version: " + version)) throw new Error("Incorrect TOC version: " + name);
    const entries = toc.split(/\r?\n/).filter(line => line.trim() && !line.startsWith("#"));
    if (!entries.includes("__loader.lua") || !entries.includes("__start.lua")) throw new Error("Missing addon loader: " + name);
    for (const entry of entries) {
        const relative = entry.replaceAll("\\", "/");
        const file = path.resolve(directory, relative);
        if (!file.startsWith(directory + path.sep) || !file.endsWith(".lua") || !fs.statSync(file).isFile()) throw new Error("Non-standalone TOC entry: " + entry);
    }
}
try {
    const { version, notes } = releaseMetadata();
    if (process.argv.includes("--check")) {
        console.log("Release metadata valid: v" + version);
    } else {
        // Only this dedicated, repository-owned staging directory is cleaned.
        const stage = path.resolve(root, "dist/release");
        if (path.relative(root, stage) !== path.join("dist", "release")) throw new Error("Unexpected staging directory");
        fs.rmSync(stage, { recursive: true, force: true });
        buildAddons(stage);
        for (const addon of addons) {
            const directory = path.join(stage, addon.name);
            validateAddon(directory, addon.name, version);
            fs.copyFileSync(path.join(root, "CHANGELOG.md"), path.join(directory, "CHANGELOG.md"));
            fs.copyFileSync(path.join(root, addon.name === "LumaUI" ? "README.md" : path.join(addon.directory, "README.md")), path.join(directory, "README.md"));
            if (addon.name === "LumaUI") fs.cpSync(path.join(root, "docs"), path.join(directory, "docs"), { recursive: true });
        }
        // Exercise the exact Lua trees that will be shipped together.
        run(process.execPath, [path.join(root, "tests/collections.integration.cjs")], { cwd: root, env: { ...process.env, LUMAUI_OUTPUT_ROOT: stage } });
        const artifacts = path.join(root, "artifacts"); fs.mkdirSync(artifacts, { recursive: true });
        const filename = "LumaUI-" + version + ".zip";
        const archive = path.join(artifacts, filename); fs.rmSync(archive, { force: true });
        if (process.platform === "win32") {
            run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
                '$ErrorActionPreference = "Stop"; $folders = $env:LUMAUI_RELEASE_NAMES.Split(",") | ForEach-Object { Join-Path $env:LUMAUI_RELEASE_STAGE $_ }; Compress-Archive -LiteralPath $folders -DestinationPath $env:LUMAUI_RELEASE_ARCHIVE -CompressionLevel Optimal -Force'],
                { env: { ...process.env, LUMAUI_RELEASE_NAMES: addons.map(addon => addon.name).join(","), LUMAUI_RELEASE_STAGE: stage, LUMAUI_RELEASE_ARCHIVE: archive } });
        } else {
            run("zip", ["-q", "-r", archive, ...addons.map(addon => addon.name)], { cwd: stage });
        }
        const hash = createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
        fs.writeFileSync(path.join(artifacts, "SHA256SUMS"), hash + "  " + filename + "\n");
        fs.writeFileSync(path.join(artifacts, "release-notes.md"), notes + "\n");
        console.log("Release archive: " + archive);
    }
} catch (error) { console.error(error.message); process.exitCode = 1; }
