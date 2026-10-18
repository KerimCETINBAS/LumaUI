import { UI } from "wuira/ui";
import { wuira } from "wuira";
import { Button, Cell, FlowLayout, Label, Background, Border, ScrollHost } from "wuira/ui";
import { Core } from "../core";
import { Glyph } from "../chrome/Glyph";
import { SingleLine } from "../chrome/SingleLine";
import type { FormState } from "./InspectorControls";

declare function LibStub(this: void, major: string, silent?: boolean): { HashTable(kind: string): Record<string, string> | undefined } | undefined;
declare function GetAtlasInfo(this: void, atlas: string): unknown;
declare const C_Texture: { GetAtlasInfo?(this: void, atlas: string): unknown } | undefined;

interface TextureOption { label: string; value: string; path: string; }

const solid = "Interface\\Buttons\\WHITE8X8";

const blizzardBar = "Interface\\TargetingFrame\\UI-StatusBar";
const skillsBar = "Interface\\PaperDollInfoFrame\\UI-Character-Skills-Bar";
const raidBar = "Interface\\RaidFrame\\Raid-Bar-Hp-Fill";
const foreverBars = "Interface\\AddOns\\ForeverAuras\\Media\\Textures\\";

/** Status-bar art only. Shapes and spell alerts belong to texture regions, not bar fills. */
const fallbackBars: TextureOption[] = [
    { label: "Blizzard", value: "blizzard", path: blizzardBar },
    { label: "Blizzard Character Skills Bar", value: skillsBar, path: skillsBar },
    { label: "Blizzard Ebon Might", value: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-EbonMight", path: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-EbonMight" },
    { label: "Blizzard Energy", value: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Energy", path: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Energy" },
    { label: "Blizzard Focus", value: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Focus", path: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Focus" },
    { label: "Blizzard Fury", value: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Fury", path: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Fury" },
    { label: "Blizzard Insanity", value: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Insanity", path: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Insanity" },
    { label: "Blizzard Lunar Power", value: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-LunarPower", path: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-LunarPower" },
    { label: "Blizzard Maelstrom", value: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Maelstrom", path: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Maelstrom" },
    { label: "Blizzard Mana", value: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Mana", path: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Mana" },
    { label: "Blizzard Pain", value: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Pain", path: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Pain" },
    { label: "Blizzard Rage", value: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Rage", path: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-Rage" },
    { label: "Blizzard Raid Bar", value: raidBar, path: raidBar },
    { label: "Blizzard RunicPower", value: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-RunicPower", path: "UI-HUD-UnitFrame-Player-PortraitOff-Bar-RunicPower" },
    { label: "Clean", value: foreverBars + "Statusbar_Clean", path: foreverBars + "Statusbar_Clean" },
    { label: "Solid", value: "solid", path: solid },
    { label: "Stripes", value: foreverBars + "Statusbar_Stripes", path: foreverBars + "Statusbar_Stripes" },
    { label: "Thick Stripes", value: foreverBars + "Statusbar_Stripes_Thick", path: foreverBars + "Statusbar_Stripes_Thick" },
    { label: "Thin Stripes", value: foreverBars + "Statusbar_Stripes_Thin", path: foreverBars + "Statusbar_Stripes_Thin" },
];

const catalogs: Record<"background" | "border", TextureOption[]> = {
    background: [
        { label: "Default", value: "", path: "" },
        { label: "Solid", value: "solid", path: solid },
        { label: "Tooltip", value: "tooltip", path: "Interface\\Tooltips\\UI-Tooltip-Background" },
        { label: "Dialog", value: "dialog", path: "Interface\\DialogFrame\\UI-DialogBox-Background" },
        { label: "Dialog dark", value: "dialogDark", path: "Interface\\DialogFrame\\UI-DialogBox-Background-Dark" },
        { label: "Dialog gold", value: "dialogGold", path: "Interface\\DialogFrame\\UI-DialogBox-Gold-Background" },
    ],
    border: [
        { label: "Default", value: "", path: "" },
        { label: "Solid", value: "solid", path: "" },
        { label: "Tooltip", value: "tooltip", path: "Interface\\Tooltips\\UI-Tooltip-Border" },
        { label: "Dialog", value: "dialog", path: "Interface\\DialogFrame\\UI-DialogBox-Border" },
        { label: "Dialog gold", value: "dialogGold", path: "Interface\\DialogFrame\\UI-DialogBox-Gold-Border" },
        { label: "Achievement wood", value: "achievementWood", path: "Interface\\AchievementFrame\\UI-Achievement-WoodBorder" },
        { label: "Chat bubble", value: "chatBubble", path: "Interface\\Tooltips\\ChatBubble-Backdrop" },
        { label: "Party", value: "party", path: "Interface\\CHARACTERFRAME\\UI-Party-Border" },
    ],
};

function fileId(value: string): number | undefined {
    if (value.length === 0) return undefined;
    let index = 0;
    while (index < value.length) {
        const code = value.charCodeAt(index);
        if (code < 48 || code > 57) return undefined;
        index++;
    }
    return Number(value);
}

function storedBar(name: string, path: string): string {
    if (name === "Solid" || path === solid) return "solid";
    if (name === "Blizzard" || path === blizzardBar) return "blizzard";
    return path;
}

/** WeakAuras reads these from LibSharedMedia: game power-bar atlases plus its own stripe files. */
function barTextures(): TextureOption[] {
    const media = typeof LibStub === "function" ? LibStub("LibSharedMedia-3.0", true) : undefined;
    if (media === undefined) return fallbackBars.slice();
    const options: TextureOption[] = [];
    for (const kind of ["statusbar", "statusbar_atlas"]) {
        const table = media.HashTable(kind);
        if (table === undefined) continue;
        for (const name in table) {
            const path = table[name];
            if (typeof path !== "string" || path === "") continue;
            if (options.some(option => option.label === name)) continue;
            options.push({ label: name, value: storedBar(name, path), path });
        }
    }
    if (options.length === 0) return fallbackBars.slice();
    options.sort((left, right) => left.label < right.label ? -1 : left.label > right.label ? 1 : 0);
    return options;
}

function optionsFor(kind: "progress" | "background" | "border", current: string): TextureOption[] {
    const options = kind === "progress" ? barTextures() : catalogs[kind].slice();
    const known = current === "" || options.some(option => option.value === current || (option.path !== "" && option.path === current));
    if (!known) options.unshift({ label: current, value: current, path: current });
    return options;
}

function Swatch({ path, width, height }: { path: string; width: number; height: number }) {
    return <Cell width={width} height={height} onMount={frame => {
        const texture = frame.CreateTexture(undefined, "OVERLAY") as wuiraNativeTexture & { SetAtlas(atlas: string): void };
        texture.SetAllPoints(frame);
        const id = fileId(path);
        const atlas = path !== "" && typeof GetAtlasInfo === "function" ? GetAtlasInfo(path) : undefined;
        const clientAtlas = atlas === undefined && path !== "" && C_Texture !== undefined && C_Texture.GetAtlasInfo !== undefined ? C_Texture.GetAtlasInfo(path) : undefined;
        if (id !== undefined) texture.SetTexture(id);
        else if ((atlas !== undefined || clientAtlas !== undefined) && texture.SetAtlas !== undefined) texture.SetAtlas(path);
        else if (path === "") texture.SetColorTexture(1, 1, 1, 1);
        else texture.SetTexture(path);
    }} />;
}

/** Texture choice with a live swatch of the client file. */
export function TextureField({ state, name, title, width, kind }: { state: FormState; name: string; title: string; width: number; kind: "progress" | "background" | "border" }) {
    const current = state.values[name] ?? "";
    const options = optionsFor(kind, current);
    const selected = options.find(option => option.value === current || (current !== "" && option.path !== "" && option.path === current))
        ?? options.find(option => option.value === "solid") ?? options[0];
    let host: wuiraNativeFrame | undefined, popup: wuiraNativeFrame | undefined;
    const close = () => { if (popup !== undefined) wuira.Unmount(popup); popup = undefined; };
    const open = () => {
        close(); if (host === undefined) return;
        const row = 32;
        const height = Math.max(row, Math.min(7, options.length) * row);
        popup = wuira.Mount(<Cell width={width} height={height + 8} padding={4} clickThrough={false}
            onMount={frame => { frame.SetFrameStrata("TOOLTIP"); frame.ClearAllPoints(); frame.SetPoint("TOPLEFT", host!, "BOTTOMLEFT", 0, -2); frame.SetClampedToScreen(true); }}
            decorations={{ background: new Background({ color: Core.Theme.colors.surface }), border: new Border({ color: Core.Theme.colors.border, thickness: 1 }) }}>
            <Cell width={width - 8} height={height} onMount={frame => {
                const scroll = new ScrollHost(frame);
                let content: wuiraNativeFrame | undefined;
                try {
                    content = wuira.Mount(<FlowLayout width={width - 16} height={Math.max(row, options.length * row)} gap={0}>
                        {options.map(option => <Button width={width - 16} height={row} onClick={() => { close(); state.Set(name, option.value); }}>
                            <FlowLayout width={width - 20} height={row} direction="horizontal" gap={6} padding={{ left: 4, top: 8 }}>
                                <Swatch path={option.path} width={72} height={16} />
                                <SingleLine width={Math.max(0, width - 106)} height={16} text={option.label} size={10} color={Core.Theme.colors.text} />
                            </FlowLayout>
                        </Button>)}
                    </FlowLayout>, undefined, scroll.Frame);
                    const index = options.findIndex(option => option.value === selected.value);
                    scroll.SetContent(content!, Math.max(0, index) * row);
                } catch (failure) { scroll.Dispose(); if (content !== undefined) wuira.Unmount(content); throw failure; }
                return () => { if (content !== undefined) wuira.Unmount(content); scroll.Dispose(); };
            }} />
        </Cell>, undefined, UIParent);
    };
    return <FlowLayout width={width} height={48} gap={4}>
        <Label width={width} height={16} text={title} fontSize={10} />
        <Button width={width} height={28} onClick={() => { if (popup === undefined) open(); else close(); }}
            onMount={frame => { host = frame; return () => { close(); host = undefined; }; }}
            decorations={{ background: new Background({ color: Core.Theme.colors.border }) }}>
            <FlowLayout width={width} height={28} direction="horizontal" gap={6} padding={{ left: 4, right: 6, top: 6 }}>
                <Swatch path={selected.path} width={72} height={16} />
                <SingleLine width={Math.max(0, width - 108)} height={16} text={selected.label} size={10} color={Core.Theme.colors.text} />
                <Glyph name="chevron-down" size={14} />
            </FlowLayout>
        </Button>
    </FlowLayout>;
}
