import { PaladinSpells } from "wuira/spells";
import type { Properties } from "lumaui/core";
import { Core } from "./core";

const labels: Record<string, string> = {
    cell: "Cell", flow: "Flow layout", grid: "Grid layout", foreach: "Repeat list (ForEach)",
    progress: "Progress bar", action: "Secure button", label: "Label", icon: "Icon",
    unitPortrait: "Unit portrait", unitText: "Unit text", unitIndicator: "Role / leader icon",
    unitAuraIndicator: "Aura action indicator", unitAuras: "Unit auras", fragment: "Headless group", hideUnitFrame: "Hide native unit frame",
    hideActionBars: "Hide native action bars",
};
export function elementLabel(kind: string): string { return labels[kind] ?? kind; }
export function elementChoices(): { label: string; value: string }[] {
    const order = ["cell", "flow", "grid", "foreach", "progress", "action", "label", "icon", "unitPortrait", "unitText", "unitIndicator", "unitAuras", "fragment", "hideUnitFrame", "hideActionBars"];
    const rank = (value: string) => { const index = order.indexOf(value); return index < 0 ? order.length : index; };
    return Core.Presets.ComponentTypes().filter(type => type !== "preset").map(type => {
        const value = type === "secureButton" ? "action" : type;
        return { label: elementLabel(value), value };
    }).sort((a, b) => rank(a.value) - rank(b.value));
}
export function elementDefaults(kind: string, unit: string): { width: number; height: number; props: Properties } {
    const container = ["cell", "flow", "grid"].includes(kind);
    const text = ["label", "unitText"].includes(kind);
    const width = kind === "foreach" ? 0 : container || text || kind === "unitAuras" ? 140 : kind === "progress" ? 180 : 32;
    const height = kind === "foreach" ? 0 : container ? 80 : text ? 18 : kind === "progress" ? 24 : kind === "unitAuras" ? 20 : 32;
    const props: Properties = ["fragment", "preset", "hideActionBars", "hideUnitFrame"].includes(kind) ? {} : { width, height };
    if (kind === "flow") props.direction = "vertical";
    if (kind === "grid") props.columns = 2;
    if (kind === "label") props.text = "Label";
    if (["unitPortrait", "unitText", "unitIndicator", "unitAuras"].includes(kind)) props.unit = unit;
    if (kind === "unitText") props.field = "name";
    if (kind === "unitIndicator") props.field = "role";
    if (kind === "unitAuras") { props.category = "buffs"; props.iconSize = 20; props.maxIcons = 6; }
    if (kind === "unitAuraIndicator") { props.unit = unit; props.category = "dispellable"; props.spellId = PaladinSpells.Purify; props.iconSize = 12; }
    if (kind === "hideUnitFrame") props.unit = "player";
    if (kind === "action" && unit === "$unit") { props.unit = unit; props.clickCastPreset = "standard"; }
    if (kind === "foreach") Object.assign(props, { key: "key", direction: "vertical", wrapAfter: 5, gap: 4, lineGap: 8 });
    return { width, height, props };
}
