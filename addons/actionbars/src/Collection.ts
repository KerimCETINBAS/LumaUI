import { Spells } from "wuira";
import type { PresetDocument, PresetNode, SourceSpec } from "lumaui/core";
import type { ActionRow } from "./actionDefinitions";
import { Core } from "./core";
/** Initial data only. Once saved, collection edits are never regenerated on reload. */
export function createActionCollection(rows: readonly ActionRow[], position: { x: number; y: number }): PresetDocument {
    const gap = 4;
    const rowWidth = (row: ActionRow) => { const count = Math.min(row.actions.length, row.columns ?? row.actions.length); return count * row.size + Math.max(0, count - 1) * gap; };
    const rowHeight = (row: ActionRow) => { const lines = Math.ceil(row.actions.length / (row.columns ?? row.actions.length)); return lines * row.size + Math.max(0, lines - 1) * gap; };
    const width = Math.max(1, ...rows.map(rowWidth));
    const height = Math.max(1, rows.reduce((sum, row) => sum + rowHeight(row), 0) + Math.max(0, rows.length - 1) * gap);
    const sources: SourceSpec[] = [];
    const children: PresetNode[] = rows.map((row, index) => ({ id: "row-" + index, type: "flow",
        props: { width: rowWidth(row), height: rowHeight(row), direction: "horizontal", gap, grow: row.columns !== undefined, justify: "center", margin: { left: (width - rowWidth(row)) / 2 } },
        children: row.actions.map(action => {
            const name = "spell-" + action.spell;
            sources.push({ name, type: "spell", props: { spellId: action.spell } });
            const pending = action.spell === Spells.DivineFavor ? "pending-" + action.spell : undefined;
            if (pending !== undefined) sources.push({ name: pending, type: "aura", props: { unit: "player", spellId: action.spell, activeAlpha: .4, inactiveAlpha: 1 } });
            return { id: name, type: "secureButton", source: name, ...(pending === undefined ? {} : { alphaSource: pending }),
                props: { width: row.size, height: row.size, finishGlow: true, borderColor: { ...Core.Theme.colors.border }, borderWidth: 1,
                    ...(action.binding === undefined ? {} : { binding: action.binding }) }, children: [
                    { id: "icon-" + action.spell, type: "icon", source: name, props: { width: "inherit", height: "inherit", margin: 1, texCoords: [.07,.93,.07,.93] } },
                ] };
        }),
    }));
    return { version: 1, kind: "preset", id: "action-bars", name: "Action bars", owner: "LumaUI_ActionBars", sources,
        root: { id: "action-bars", type: "flow", props: { width, height, direction: "vertical", gap, mode: "absolute", anchor: "CENTER", x: position.x, y: position.y }, children } };
}
