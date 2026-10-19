import { SpellSource, UseSource } from "wuira/datasources";
import type { EditorDraft, EditorNode } from "../draft/Draft";
import { Core } from "../core";
import { elementLabel } from "../catalogs/ElementCatalog";
export interface NodePresentation { title: string; detail: string; tag: string; texture?: string | number; }
const tags: Record<string, string> = { cell: "[]", flow: "=", grid: "#", foreach: "*", action: "A", progress: "-", label: "T", icon: "I", preset: "@", fragment: "G", hideActionBars: "H", hideUnitFrame: "H" };
const sourceNames: Record<string, string> = { hp: "Health", mana: "Mana", power: "Primary resource", gcd: "Global cooldown", cast: "Cast timer", swing: "Swing timer", totem: "Totem timer", aura: "Aura timer", cooldown: "Cooldown" };
function words(id: string): string {
    let result = "";
    for (let index = 0; index < id.length; index++) {
        const char = id[index], previous = id[index - 1];
        if (char === "-" || char === "_") result += " ";
        else { if (index > 0 && char >= "A" && char <= "Z" && previous >= "a" && previous <= "z") result += " "; result += char; }
    }
    return result.length === 0 ? "Element" : result[0].toUpperCase() + result.slice(1);
}
/** Read identity only: no cooldown bindings or subscriptions are allocated. */
export function describeNode(draft: EditorDraft, node: EditorNode): NodePresentation {
    const type = elementLabel(node.kind), count = draft.Children(node.id).length;
    let title = words(node.id), texture: string | number | undefined;
    const spec = draft.sources.find(source => source.name === node.source);
    const action = node.props?.action as { spell?: number | string } | undefined;
    const spell = spec?.props.spellId ?? action?.spell;
    if (node === draft.nodes[0]) title = draft.documentName;
    else if (node.kind === "preset") title = draft.dependencies.find(doc => doc.id === node.preset)?.name ?? Core.Presets.Get(node.preset!)?.name ?? "Shared component";
    else if (typeof spell === "number") {
        title = "Spell " + spell;
        const identity = UseSource(SpellSource, spell);
        try { title = identity.Value ?? title; texture = identity.Texture.Value; } catch { /* Keep the editable fallback when identity is unavailable. */ }
        if (node.kind === "icon") title += " icon";
    } else if (typeof spell === "string") title = spell;
    else if (node.source === "item") title = node.kind === "action" ? "Spell button template" : node.kind === "icon" ? "Spell icon" : "Current item";
    else if (spec !== undefined && sourceNames[spec.type] !== undefined) title = sourceNames[spec.type];
    else if (node.kind === "label" && typeof node.props?.text === "string" && node.props.text.trim().length > 0) title = node.props.text;
    else if (node.kind === "flow") {
        const siblings = draft.Children(node.parent).filter(child => child.kind === "flow");
        title = (node.props?.direction === "horizontal" ? "Row " : "Column ") + (siblings.findIndex(child => child.id === node.id) + 1);
    }
    const rawName = (node.kind === "action" ? "secureButton" : node.kind) + " " + node.id;
    if (node !== draft.nodes[0] && node.name !== rawName && node.name !== elementLabel(node.kind) && node.name !== "Spell icon") title = node.name;
    if (node.label !== undefined) title = node.label;
    return { title, detail: type + (count > 0 ? " · " + count + (count === 1 ? " child" : " children") : ""), tag: tags[node.kind] ?? "U", texture };
}
