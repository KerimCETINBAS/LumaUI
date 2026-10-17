import type { PresetDocument, PresetNode } from "../core/builder";
/** Retired bar-only effects become ordinary native-frame targets without changing IDs. */
export function migrateNativeVisibility(document: PresetDocument): boolean {
    let changed = false;
    const visit = (node: PresetNode) => {
        if (node === undefined || node === null || typeof node !== "object") return;
        if (node.type === "hideActionBars") {
            node.type = "hideUnitFrame"; node.props = { ...node.props, unit: "actionBars" }; changed = true;
        }
        if (Array.isArray(node.children)) for (const child of node.children) visit(child);
    };
    visit(document.root); return changed;
}
