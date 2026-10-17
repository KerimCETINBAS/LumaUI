import { UI, wuira } from "wuira";
import type { Cell as View } from "wuira";
import { Cell, FlowLayout, Button, Background, Border, Label, Tooltip } from "wuira/ui";
import type { ComponentPreviewProps, LumaTheme, PresetAPI, PresetDocument, PresetInstance, PresetNode, PreviewZoom } from "../core/contract";

/** Read-only native preview shared by the editor and import dialog. */
export function ComponentPreview(props: ComponentPreviewProps, presets: PresetAPI, theme: LumaTheme) {
    let zoom: PreviewZoom = props.zoom ?? 1;
    let content: wuiraNativeFrame | undefined, host: wuiraNativeFrame | undefined, caption: wuiraNativeFontString | undefined;
    let live = true, scaling = false;
    if (zoom !== "fit" && (!Number.isFinite(zoom) || zoom <= 0)) throw "Preview zoom must be positive and finite.";
    const scale = () => {
        if (!live || scaling || content === undefined || host === undefined) return;
        const value = zoom === "fit" ? Math.min(1, (host.GetWidth() - 16) / Math.max(1, content.GetWidth()), (host.GetHeight() - 16) / Math.max(1, content.GetHeight())) : zoom;
        const applied = Math.max(zoom === "fit" ? .000001 : .05, Math.min(4, value));
        scaling = true; try { if (content.GetScale() !== applied) content.SetScale(applied); } finally { scaling = false; }
        caption?.SetText(zoom === "fit" ? "Fit" : Math.round(value * 100) + "%");
    };
    const change = (value: PreviewZoom) => { zoom = value; scale(); props.onZoomChange?.(value); };
    const step = (direction: number) => change(Math.max(.05, Math.min(4, (content?.GetScale() ?? 1) * (direction > 0 ? 1.25 : .8))));
    const control = (text: string, width: number, click: () => void) => <Button width={width} height={24} onClick={click}
        decorations={{ background: new Background({ color: theme.colors.border }) }}><Label text={text} align="CENTER" fontSize={10} /></Button>;
    return <FlowLayout width={props.width} height={props.height} gap={6}>
        <FlowLayout width={props.width} height={24} direction="horizontal" gap={4}>
            <Label width={Math.max(0, props.width - 216)} height={24} text="PREVIEW" fontSize={10} color={theme.colors.muted} />
            {control("-", 28, () => step(-1))}{control("+", 28, () => step(1))}
            {control("1:1", 42, () => change(1))}{control("Fit", 42, () => change("fit"))}
            <Cell width={56} height={24} onMount={frame => {
                caption = frame.CreateFontString(undefined, "OVERLAY"); caption.SetAllPoints(frame);
                caption.SetFont("Fonts\\FRIZQT__.TTF", 10, ""); caption.SetTextColor(theme.colors.accent.r, theme.colors.accent.g, theme.colors.accent.b, 1);
                caption.SetText(zoom === "fit" ? "Fit" : Math.round(zoom * 100) + "%");
                return () => { caption = undefined; };
            }} />
        </FlowLayout>
        <Cell width={props.width} height={Math.max(24, props.height - 30)} clickThrough={false}
            decorations={{ background: new Background({ color: { r: .012, g: .018, b: .028, a: 1 } }), border: new Border({ thickness: 1, color: theme.colors.border }) }}
            onMount={frame => {
                host = frame; frame.SetClipsChildren(true);
                const stop = mountComponentPreview(frame, props.document, props.selected, props.onSelect, presets, theme, mounted => { content = mounted; scale(); });
                frame.HookScript("OnSizeChanged", scale); content?.HookScript("OnSizeChanged", scale);
                return () => { live = false; content = undefined; host = undefined; stop(); };
            }} />
    </FlowLayout>;
}
function mountComponentPreview(host: wuiraNativeFrame, document: PresetDocument, selected: string | undefined, onSelect: ((id: string) => void) | undefined,
    presets: PresetAPI, theme: LumaTheme, mounted: (frame: wuiraNativeFrame) => void, compact = false): () => void {
    let instance: PresetInstance | undefined, frame: wuiraNativeFrame | undefined, outline: Border | undefined, overlay: wuiraNativeFrame | undefined;
    const pickerCleanups: (() => void)[] = [];
    const dispose = () => {
        outline?.dispose(); overlay?.Hide(); for (const cleanup of pickerCleanups) cleanup();
        if (frame !== undefined) wuira.Unmount(frame); instance?.Dispose();
    };
    try {
        instance = presets.Preview(document);
        const view = instance.View;
        if (view === undefined) {
            frame = wuira.Mount(Label({ text: compact ? "No visual" : "Headless component: no visual output. Effects run only when applied.", fontSize: 11, color: theme.colors.muted }), undefined, host);
            return dispose;
        }
        const rebase = (cell: View) => {
            const input = cell.props as Record<string, unknown>;
            if (cell === view) {
                input.mode = "relative"; input.anchor = "CENTER"; input.relativeAnchor = "CENTER"; input.offset = { x: 0, y: 0 }; input.margin = 0;
                delete input.relativeTo; delete input.x; delete input.y;
            } else if (input.mode === "absolute") {
                input.mode = "relative"; input.relativeTo = view; input.offset = { x: input.x ?? 0, y: input.y ?? 0 }; delete input.x; delete input.y;
            }
            if (cell.child !== undefined) rebase(cell.child); for (const child of cell.children ?? []) rebase(child);
        };
        rebase(view); frame = wuira.Mount(view, undefined, host); if (frame !== undefined) mounted(frame);
        const nodes: { node: PresetNode; parent?: PresetNode; depth: number }[] = [];
        const visit = (node: PresetNode, parent?: PresetNode, depth = 0) => { nodes.push({ node, parent, depth }); for (const child of node.children ?? []) visit(child, node, depth + 1); };
        visit(document.root);
        if (onSelect !== undefined) {
            const picked = new Set<wuiraNativeFrame>();
            instance.Nodes.forEach((target, key) => {
                const entry = nodes.find(entry => entry.node.id === key) ?? nodes.find(entry => key.endsWith("/" + entry.node.id));
                if (entry === undefined || picked.has(target) || !target.IsShown()) return;
                if (entry.node.type === "icon" && entry.parent?.type === "secureButton") return;
                picked.add(target);
                const picker = CreateFrame("Button", undefined, target);
                picker.SetAllPoints(target); picker.SetSize(target.GetWidth(), target.GetHeight());
                picker.SetFrameLevel(target.GetFrameLevel() + 20 + entry.depth); picker.EnableMouse(true);
                let hover: Border | undefined;
                const tooltip = new Tooltip({ text: "Click to select", lines: [{ text: "Element: " + entry.node.id + " · preview actions are disabled." }] });
                tooltip.mount(picker, target.GetWidth(), target.GetHeight());
                picker.SetScript("OnClick", () => onSelect(entry.node.id));
                picker.SetScript("OnEnter", () => { hover?.dispose(); hover = new Border({ thickness: 1, color: { ...theme.colors.accent, a: .5 } }); hover.mount(picker, target.GetWidth(), target.GetHeight()); });
                picker.SetScript("OnLeave", () => { hover?.dispose(); hover = undefined; }); picker.Show();
                pickerCleanups.push(() => { hover?.dispose(); tooltip.dispose(); picker.SetScript("OnClick", undefined); picker.SetScript("OnEnter", undefined); picker.SetScript("OnLeave", undefined); picker.EnableMouse(false); picker.Hide(); });
            });
        }
        const target = selected === undefined ? undefined : instance.Nodes.get(selected) ?? [...instance.Nodes].find(([key]) => key.endsWith("/" + selected))?.[1];
        if (target !== undefined) {
            overlay = CreateFrame("Frame", undefined, target); overlay.SetAllPoints(target); overlay.SetFrameLevel(target.GetFrameLevel() + 10); overlay.EnableMouse(false);
            outline = new Border({ thickness: 1, color: theme.colors.accent }); outline.mount(overlay, target.GetWidth(), target.GetHeight()); overlay.Show();
        }
        return dispose;
    } catch (failure) {
        dispose(); frame = wuira.Mount(Label({ text: compact ? "Preview unavailable" : "Preview: " + String(failure), color: theme.colors.accent }), undefined, host);
        return () => { if (frame !== undefined) wuira.Unmount(frame); };
    }
}

/** Library thumbnails never construct sources or bind live unit values. */
export function thumbnailDocument(input: PresetDocument, presets: PresetAPI): PresetDocument {
    const available = new Map([...presets.List(), ...input.dependencies ?? [], input].map(doc => [doc.id, doc]));
    const output = new Map<string, PresetDocument>(), visiting = new Set<string>();
    const snapshot = (document: PresetDocument): PresetDocument => {
        if (visiting.has(document.id)) throw "Cyclic component reference";
        const previous = output.get(document.id); if (previous !== undefined) return previous;
        visiting.add(document.id);
        const node = (original: PresetNode): PresetNode => {
            const { source, sourcePath, visibleSource, textSource, alphaSource, bindings, items, sourceProps, ...rest } = original;
            let type = original.type;
            let children = (original.children ?? []).map(node);
            const props = { ...original.props };
            if (type === "blizzardElement") return children[0] ?? { id: original.id, type: "fragment", props: {} };
            if (type === "foreach") {
                type = "flow"; children = children.slice(0,1);
                for (const key of Object.keys(props)) if (presets.ComponentProperties("flow")[key] === undefined) delete props[key];
                props.width = typeof children[0]?.props.width === "number" ? children[0].props.width : 192;
                props.height = typeof children[0]?.props.height === "number" ? children[0].props.height : 52;
            }
            for (const key of ["unit", "powerColorUnit"]) if (props[key] === "$unit" || props[key] === "$pet") props[key] = "player";
            if (type === "progress") { delete props.powerColorUnit; props.min=0;props.max=100;props.current=75; }
            if (type === "label" && textSource !== undefined) props.text = "Sample text";
            if (type === "icon" && source !== undefined) {
                const spec = document.sources.find(item=>item.name===source), ids=spec?.props.spellIds;
                const id = spec?.props.spellId ?? (Array.isArray(ids) ? ids[0] : undefined);
                const texture = typeof id === "number" ? C_Spell?.GetSpellTexture?.(id) : undefined;
                props.texture = texture !== undefined && !issecretvalue(texture) ? texture : "Interface\\Icons\\INV_Misc_QuestionMark";
            }
            if (original.preset !== undefined) {
                const child = available.get(original.preset); if (child === undefined) throw "Missing component reference";
                snapshot(child);
            }
            return { ...rest, type, props, children };
        };
        const { dependencies, ...base } = document;
        const result = { ...base, sources: [], root: node(document.root) };
        output.set(document.id,result);visiting.delete(document.id);return result;
    };
    const result=snapshot(input);
    return { ...result, dependencies: Array.from(output.values()).filter(doc=>doc.id!==input.id) };
}

/** Small read-only library preview, with no toolbar or element pickers. */
export function ComponentThumbnail(document: import("../core/contract").BuilderDocument, width: number, height: number, presets: PresetAPI, theme: LumaTheme) {
    if (document.kind !== "preset") return <Cell width={width} height={height} decorations={{ background: new Background({ color: theme.colors.surface }) }}><Label text="No visual" align="CENTER" fontSize={10} color={theme.colors.muted} /></Cell>;
    return <Cell width={width} height={height} clickThrough decorations={{ background: new Background({ color: {r:.012,g:.018,b:.028,a:1} }) }} onMount={host => {
        let live = true, content: wuiraNativeFrame | undefined;
        host.SetClipsChildren(true);
        const fit = () => {
            if (!live || content === undefined) return;
            const w=host.GetWidth(), h=host.GetHeight(), cw=content.GetWidth(), ch=content.GetHeight();
            if ([w,h,cw,ch].some(value=>issecretvalue(value))) return;
            const value = Math.max(.000001, Math.min(1, (w-12)/Math.max(1,cw), (h-12)/Math.max(1,ch)));
            if (content.GetScale() !== value) content.SetScale(value);
        };
        let stop: () => void;
        try { stop = mountComponentPreview(host, thumbnailDocument(document,presets), undefined, undefined, presets, theme, frame => { content = frame; fit(); }, true); }
        catch { const label=wuira.Mount(Label({text:"Preview unavailable",fontSize:10,align:"CENTER",color:theme.colors.muted}),undefined,host); stop=()=>{if(label!==undefined)wuira.Unmount(label);}; }
        host.HookScript("OnSizeChanged",fit);content?.HookScript("OnSizeChanged",fit);
        return () => { live=false;content=undefined;stop(); };
    }} />;
}
