import { wuira } from "wuira";
import type { Cell } from "wuira";
import { Border, Label, Tooltip } from "wuira/ui";
import type { EditorNode } from "./Draft";
import type { PresetDocument, PresetInstance } from "lumaui/core";
import { Core } from "./core";

/** The runtime's actual descriptors, centered at their original size in the editor. */
export function mountPreview(host: wuiraNativeFrame, document: PresetDocument, selected: string, onSelect?: (id: string) => void, nodes: readonly EditorNode[] = []): () => void {
    let instance: PresetInstance | undefined;
    let frame: wuiraNativeFrame | undefined;
    let outline: Border | undefined;
    let overlay: wuiraNativeFrame | undefined;
    const pickerCleanups: (() => void)[] = [];
    const dispose = () => {
        outline?.dispose(); overlay?.Hide();
        for (const cleanup of pickerCleanups) cleanup();
        if (frame !== undefined) wuira.Unmount(frame);
        instance?.Dispose();
    };
    try {
        instance = Core.Presets.Preview(document);
        const view = instance.View;
        if (view === undefined) {
            frame = wuira.Mount(Label({ text: "Headless component: no visual output. Effects run only when applied.", fontSize: 11, color: Core.Theme.colors.muted }), undefined, host);
            return dispose;
        }
        const rebase = (cell: Cell) => {
            const props = cell.props as Record<string, unknown>;
            if (cell === view) {
                props.mode = "relative";
                props.anchor = "CENTER";
                props.relativeAnchor = "CENTER";
                props.offset = { x: 0, y: 0 };
                props.margin = 0;
                delete props.relativeTo; delete props.x; delete props.y;
            } else if (props.mode === "absolute") {
                props.mode = "relative";
                props.relativeTo = view;
                props.offset = { x: props.x ?? 0, y: props.y ?? 0 };
                delete props.x; delete props.y;
            }
            if (cell.child !== undefined) rebase(cell.child);
            for (const child of cell.children ?? []) rebase(child);
        };
        rebase(view);
        frame = wuira.Mount(view, undefined, host);
        if (onSelect !== undefined) {
            const picked = new Set<wuiraNativeFrame>();
            instance.Nodes.forEach((target, key) => {
                const node = nodes.find(node => node.id === key) ?? nodes.find(node => key.endsWith("/" + node.id));
                if (node === undefined || picked.has(target) || !target.IsShown()) return;
                if (node.kind === "icon" && nodes.find(parent => parent.id === node.parent)?.kind === "action") return;
                picked.add(target);
                let depth = 0, parent = node;
                while (parent.parent !== "") { const ancestor = nodes.find(item => item.id === parent.parent); if (ancestor === undefined) break; parent = ancestor; depth++; }
                const picker = CreateFrame("Button", undefined, target);
                picker.SetAllPoints(target); picker.SetSize(target.GetWidth(), target.GetHeight());
                picker.SetFrameLevel(target.GetFrameLevel() + 20 + depth); picker.EnableMouse(true);
                let hover: Border | undefined;
                const tooltip = new Tooltip({ text: "Click to select", lines: [{ text: node.kind === "action" ? "Spell button · actions are disabled in the editor." : "Element: " + node.id }] });
                tooltip.mount(picker, target.GetWidth(), target.GetHeight());
                picker.SetScript("OnClick", () => onSelect(node.id));
                picker.SetScript("OnEnter", () => { hover?.dispose(); hover = new Border({ thickness: 1, color: { ...Core.Theme.colors.accent, a: .5 } }); hover.mount(picker, target.GetWidth(), target.GetHeight()); });
                picker.SetScript("OnLeave", () => { hover?.dispose(); hover = undefined; });
                picker.Show();
                pickerCleanups.push(() => { hover?.dispose(); tooltip.dispose(); picker.SetScript("OnClick", undefined); picker.SetScript("OnEnter", undefined); picker.SetScript("OnLeave", undefined); picker.EnableMouse(false); picker.Hide(); });
            });
        }
        const target = instance.Nodes.get(selected);
        if (target !== undefined) {
            overlay = CreateFrame("Frame", undefined, target);
            overlay.SetAllPoints(target);
            overlay.SetFrameLevel(target.GetFrameLevel() + 10);
            overlay.EnableMouse(false);
            outline = new Border({ thickness: 1, color: Core.Theme.colors.accent });
            outline.mount(overlay, target.GetWidth(), target.GetHeight());
            overlay.Show();
        }
        return dispose;
    } catch (failure) {
        dispose();
        // A bad draft must not take the editor window down with it.
        frame = wuira.Mount(Label({ text: "Preview: " + String(failure), color: Core.Theme.colors.accent }), undefined, host);
        return () => { if (frame !== undefined) wuira.Unmount(frame); };
    }
}
