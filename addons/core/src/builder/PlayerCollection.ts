import { Spells } from "wuira";
import { Store } from "wuira/store";
import type { LumaCoreAPI, PresetDocument, PresetNode, Properties } from "../core/contract";
import { sealSpellIds } from "../spells";
export class PlayerCollectionState extends Store { public static readonly Token = "lumaui.player-collection"; public initialized = false; public headlessSeeded = false; }
function barStyle(color: { r: number; g: number; b: number }, lightness = .12, alpha = 1): Properties {
    return { foreground: { color }, backdrop: { thickness: 1, color }, background: { color: {
        r: color.r + (1-color.r)*lightness, g: color.g + (1-color.g)*lightness, b: color.b + (1-color.b)*lightness, a: alpha,
    } } };
}
/** A one-time starter document. The saved collection, not this function, owns subsequent edits. */
export function createPlayerCollection(position: { x: number; y: number }): PresetDocument {
    const timer = (id: string, source: string, height: number, color: { r: number; g: number; b: number }, props: Properties = {}): PresetNode => ({
        id, type: "progress", source, visibleSource: source, props: { height, ...barStyle(color), ...props },
    });
    const hidePlayer: PresetDocument = { version: 1, kind: "preset", id: "hide-player-frame", name: "Hide player frame", sources: [],
        root: { id: "hide-player", type: "hideUnitFrame", props: { unit: "player" } } };
    return { dependencies: [hidePlayer], version: 1, kind: "preset", id: "player", name: "Player resources", sources: [
        { name: "health", type: "hp", props: { unit: "player", healPrediction: true, absorbPrediction: true } },
        { name: "mana", type: "mana", props: { unit: "player", regenTimer: true } },
        { name: "manaRegen", type: "channel", props: { source: "mana", channel: "regen" } },
        { name: "seal", type: "aura", props: { unit: "player", spellIds: [...sealSpellIds], filter: "HELPFUL" } },
        { name: "swing", type: "swing", props: {} }, { name: "gcd", type: "gcd", props: {} },
        { name: "cast", type: "cast", props: { unit: "player" } }, { name: "consecration", type: "totem", props: { spellId: Spells.Consecration } },
    ], root: { id: "player", type: "cell", props: { width: 220, height: 85, mode: "absolute", anchor: "CENTER", x: position.x, y: position.y }, children: [
        { id: "resources", type: "flow", props: { width: "inherit", height: "inherit", direction: "vertical", gap: 0 }, children: [
            { id: "sealRow", type: "flow", visibleSource: "seal", props: { width: "inherit", height: 20, direction: "horizontal", gap: 4, margin: { bottom: 1 } }, children: [
                { id: "sealIcon", type: "icon", source: "seal", props: { width: 20, height: 20, texCoords: [.07,.93,.07,.93] } },
                timer("sealBar", "seal", 20, { r: .95, g: .7, b: .22 }, { width: 196, background: false, backdrop: false }),
            ] },
            timer("consecrationBar", "consecration", 2, { r: 1, g: .82, b: .28 }, { background: false, backdrop: false }),
            { id: "healthBar", type: "progress", source: "health", props: { height: 24, ...barStyle({ r: .12, g: .73, b: .38 }, .3, .4) } },
            { id: "manaBar", type: "progress", source: "mana", props: { height: 14, ...barStyle({ r: .15, g: .4, b: .95 }, .3, .4) }, children: [
                { id: "manaRegenBar", type: "progress", source: "manaRegen", props: { height: 2, width: "inherit", anchor: "BOTTOMLEFT", relativeAnchor: "BOTTOMLEFT",
                    offset: { x: 0, y: 1 }, margin: { left: 1, right: 1 }, background: false, backdrop: false, foreground: { color: { r: .65, g: .88, b: 1, a: 1 } } } },
            ] },
            timer("swingBar", "swing", 3, { r: .82, g: .84, b: .9 }, { background: false, backdrop: false }),
            timer("gcdBar", "gcd", 3, { r: .65, g: .4, b: .95 }, { backdrop: false }),
            { ...timer("castBar", "cast", 18, { r: .95, g: .62, b: .24 }), children: [
                { id: "castName", type: "label", textSource: "cast", props: { text: "", fontSize: 11, margin: { left: 8, right: 8 } } },
            ] },
        ] },
        { id: "hide-native-player", type: "preset", preset: "hide-player-frame", props: {} },
    ] } };
}
export function seedPlayerCollection(core: LumaCoreAPI): void {
    const state = core.Store.get(PlayerCollectionState);
    if (!state.headlessSeeded) {
        const starter = createPlayerCollection(core.GetLegacyActionSettings().playerPosition);
        const hide = starter.dependencies![0];
        if (core.Presets.Get(hide.id) === undefined) core.Presets.Save(hide);
        // Existing edited player collections stay untouched; the starter is available to insert.
        core.Store.set(PlayerCollectionState, value => { value.headlessSeeded = true; return value; });
    }
    if (state.initialized) return;
    if (core.Presets.Get("player") === undefined) core.Presets.Save(createPlayerCollection(core.GetLegacyActionSettings().playerPosition), true);
    if (core.Skins.Get("default-blizzard") === undefined) core.Skins.Save({ version: 1, kind: "skin", id: "default-blizzard", name: "Blizzard presentation", targets: [
        { target: "unitFrames", props: { player: true, target: true, focus: true } }, { target: "compactMicroMenu", props: {} },
    ] }, true);
    core.Store.set(PlayerCollectionState, value => { value.initialized = true; return value; });
}
