import type { PresetDocument, PresetNode } from "../../core/builder";

/** Locate the visible root without assigning screen geometry to headless effects. */
export function positionRoot(node: PresetNode): PresetNode | undefined {
    if (["hideUnitFrame", "hideActionBars"].includes(node.type)) return undefined;
    if (node.type !== "fragment") return node;
    for (const child of node.children ?? []) { const found = positionRoot(child); if (found !== undefined) return found; }
    return undefined;
}
export function applyLayoutPosition(document: PresetDocument, key?: string): void {
    const position = key === undefined ? undefined : document.layoutPositions?.[key];
    const root = positionRoot(document.root);
    if (position === undefined || root === undefined) return;
    root.props = { ...root.props, mode: "absolute", anchor: "CENTER", relativeAnchor: "CENTER", x: position.x, y: position.y };
    delete root.props.offset; delete root.props.relativeTo;
}
