import { Store } from "wuira/store";
import type { PresetDocument, PresetNode, SourceSpec, Properties } from "lumaui/core";
import { PropertyEditor } from "./PropertyEditor";
import { SourceEditor, BindingField } from "./SourceEditor";
import { Core } from "./core";

export type NodeKind = string;
export interface EditorNode {
    id: string;
    parent: string;
    kind: NodeKind;
    name: string;
    width: number;
    height: number;
    direction: "horizontal" | "vertical";
    props?: Properties;
    source?: string;
    sourcePath?: string;
    visibleSource?: string;
    textSource?: string;
    alphaSource?: string;
    preset?: string;
}
function rootNode(): EditorNode {
    return { id: "root", parent: "", kind: "flow", name: "Root layout",
        width: 320, height: 180, direction: "vertical" };
}
export class EditorSettings extends Store {
    public static readonly Token = "lumaui.editor";
    public version = 2;
    public documentId = "editor-draft";
    public documentName = "LumaUI draft";
    public owner?: string;
    public sources: SourceSpec[] = [];
    public nodes: EditorNode[] = [rootNode()];
    public nextId = 1;
    public dependencies: PresetDocument[] = [];
}

/** Session draft backed by the same preset format used by the master runtime. */
export class EditorDraft {
    public nodes: EditorNode[];
    public nextId: number;
    public documentId: string;
    public documentName: string;
    public owner?: string;
    public sources: SourceSpec[];
    public dependencies: PresetDocument[] = [];
    public selected = "root";
    public inspector: "properties" | "sources" = "properties";
    public readonly propertyEditor = new PropertyEditor(this);
    public readonly sourceEditor = new SourceEditor(this);
    public SetInspector(tab: "properties" | "sources"): void {
        this.sourceEditor.Flush(); this.propertyEditor.Flush(); this.inspector = tab;
        if (tab === "sources") this.sourceEditor.Open(this.Selected.source ?? this.sources[0]?.name);
        else Core.RefreshCustomization();
    }
    public UpdateProperties(props: Properties): void {
        const node = this.Selected; const oldProps = node.props; node.props = props;
        try { const preview = Core.Presets.Preview(this.Document()); preview.Dispose(); }
        catch (failure) { node.props = oldProps; throw failure; }
        if (typeof props.width === "number") node.width = props.width;
        if (typeof props.height === "number") node.height = props.height;
        if (props.direction === "horizontal" || props.direction === "vertical") node.direction = props.direction;
        this.Changed("Properties updated. Apply to update the mounted collection.");
    }
    public Report(message: string): void { this.message = message; Core.RefreshCustomization(); }
    public UpdateSources(sources: SourceSpec[]): void {
        const document = Core.Presets.Validate({ ...this.Document(), sources });
        const preview = Core.Presets.Preview(document); preview.Dispose();
        this.sources = document.sources; this.Changed("Sources updated. Apply to update the mounted collection.");
    }
    public BindSource(name: string | undefined, field: BindingField, path?: string): void {
        const node = this.Selected; const previous = node[field]; const oldProps = node.props; const previousPath = node.sourcePath; const previousNodes = this.nodes; const previousId = this.nextId;
        if (name === undefined) delete node[field]; else node[field] = name;
        if (field === "source") { if (name === undefined || path === undefined || path.trim() === "") delete node.sourcePath; else node.sourcePath = path.trim(); }
        if (field === "source" && name !== undefined && node.kind === "progress" && node.props !== undefined) {
            node.props = { ...node.props }; delete node.props.min; delete node.props.max; delete node.props.current;
        }
        if (field === "source" && name !== undefined && node.kind === "action" && this.sources.find(source => source.name === name)?.type === "spell") {
            const child = this.Children(node.id)[0];
            if (child === undefined) {
                let id = "node-" + this.nextId++; while (this.nodes.some(node => node.id === id)) id = "node-" + this.nextId++;
                this.nodes = [...this.nodes, { id, parent: node.id, kind: "icon", name: "Spell icon", width: node.width, height: node.height,
                    direction: "vertical", props: { width: "inherit", height: "inherit" }, source: name }];
            } else if (child.kind === "icon") this.nodes = this.nodes.map(item => item === child ? { ...child, source: name } : item);
        }
        try { const preview = Core.Presets.Preview(this.Document()); preview.Dispose(); }
        catch (failure) { this.nodes = previousNodes; this.nextId = previousId; if (previous === undefined) delete node[field]; else node[field] = previous; node.props = oldProps; if (previousPath === undefined) delete node.sourcePath; else node.sourcePath = previousPath; this.Report(String(failure)); return; }
        this.Changed("Source binding updated.");
    }
    public treeScroll = 0;
    public DropError(id: string, targetId: string, position: "before" | "inside" | "after"): string | undefined {
        const source = this.nodes.find(node => node.id === id), target = this.nodes.find(node => node.id === targetId);
        if (source === undefined || target === undefined) return "Element not found.";
        if (source === this.nodes[0]) return "The root cannot be moved.";
        if (source === target) return "Choose another element.";
        let cursor: EditorNode | undefined = target;
        while (cursor !== undefined) { if (cursor.id === id) return "An element cannot contain itself."; cursor = this.nodes.find(node => node.id === cursor!.parent); }
        const parent = position === "inside" ? target : this.nodes.find(node => node.id === target.parent);
        if (parent === undefined || !["cell","flow","grid","action","progress","fragment"].includes(parent.kind)) return "Drop into a container.";
        if (!["flow","grid","fragment"].includes(parent.kind) && this.IsVisual(source) && this.Children(parent.id).some(child => child.id !== id && this.IsVisual(child))) return "This element accepts one child. Use a layout.";
        return undefined;
    }
    public MoveNode(id: string, targetId: string, position: "before" | "inside" | "after"): void {
        const reason = this.DropError(id,targetId,position); if (reason !== undefined) { this.Report(reason); return; }
        this.propertyEditor.Flush(); this.sourceEditor.Flush();
        const previous = this.nodes; const source = this.nodes.find(node => node.id === id)!, target = this.nodes.find(node => node.id === targetId)!;
        const parent = position === "inside" ? target.id : target.parent;
        const nodes = this.nodes.filter(node => node.id !== id);
        let index = nodes.findIndex(node => node.id === targetId) + (position === "after" ? 1 : 0);
        if (position === "inside") { const children = nodes.filter(node => node.parent === parent); index = children.length === 0 ? nodes.findIndex(node => node.id === parent) + 1 : nodes.findIndex(node => node.id === children[children.length - 1].id) + 1; }
        nodes.splice(index,0,{ ...source,parent }); this.nodes = nodes;
        try { this.Document(); } catch (failure) { this.nodes = previous; this.Report(String(failure)); return; }
        this.selected = id; this.Changed("Element moved. Apply to update the mounted collection.");
    }
    public ShiftSelected(amount: number): void {
        const siblings = this.Children(this.Selected.parent); const index = siblings.findIndex(node => node.id === this.selected);
        const target = siblings[index + amount]; if (target !== undefined) this.MoveNode(this.selected,target.id,amount < 0 ? "before" : "after");
    }
    public dirty = false;
    public message = "Select an element or add one to your layout.";

    public constructor() {
        // Store.get returns detached data; narrow the recursive schema before editing it.
        const saved = Core.Store.get(EditorSettings) as unknown as EditorSettings;
        this.nodes = saved.nodes.map(node => ({ ...node }));
        this.nextId = saved.nextId;
        this.documentId = saved.documentId;
        this.documentName = saved.documentName;
        this.owner = saved.owner;
        this.dependencies = saved.dependencies ?? [];
        this.sources = saved.sources.map(source => ({ ...source, props: { ...source.props } }));
    }

    public get Selected(): EditorNode { return this.nodes.find(node => node.id === this.selected) ?? this.nodes[0]; }
    public Children(id: string): EditorNode[] { return this.nodes.filter(node => node.parent === id); }

    public Tree(): { node: EditorNode; depth: number }[] {
        const result: { node: EditorNode; depth: number }[] = [];
        const visit = (node: EditorNode, depth: number) => {
            result.push({ node, depth });
            for (const child of this.Children(node.id)) visit(child, depth + 1);
        };
        visit(this.nodes[0], 0);
        return result;
    }

    public Select(id: string): void {
        if (this.selected === id || !this.nodes.some(node => node.id === id)) return;
        this.sourceEditor.Flush(); this.propertyEditor.Flush();
        this.selected = id;
        Core.RefreshCustomization();
    }

    public IsVisual(node: EditorNode): boolean {
        if (node.kind === "hideUnitFrame") return false;
        if (node.kind === "fragment") return this.Children(node.id).some(child => this.IsVisual(child));
        if (node.kind === "preset") {
            const doc = this.dependencies.find(doc => doc.id === node.preset) ?? Core.Presets.Get(node.preset!);
            return doc !== undefined && !Core.Presets.IsHeadless({ ...doc, dependencies: this.Dependencies(doc.root) });
        }
        return true;
    }
    public Embed(id: string): void { this.Add("preset", id); }
    public ReplacePreset(id: string): void {
        const old = this.Selected.preset; this.Selected.preset = id;
        try { this.Document(); this.Changed("Preset reference updated."); } catch (failure) { this.Selected.preset = old; this.Report(String(failure)); }
    }
    public Add(kind: NodeKind, preset?: string): void {
        let parent = this.Selected;
        if (!["flow", "grid", "cell", "fragment"].includes(parent.kind))
            parent = this.nodes.find(node => node.id === parent.parent) ?? this.nodes[0];
        const visual = kind !== "hideUnitFrame" && kind !== "fragment" && (kind !== "preset" || !Core.Presets.IsHeadless(Core.Presets.Get(preset!)!));
        if (parent.kind === "cell" && visual && this.Children(parent.id).some(node => this.IsVisual(node))) parent = this.nodes[0];
        if ((parent.kind === "cell" && visual && this.Children(parent.id).some(node => this.IsVisual(node))) || !["cell", "flow", "grid", "fragment"].includes(parent.kind)) {
            this.message = "Select a container with room for another child."; Core.RefreshCustomization(); return;
        }
        let id = "node-" + this.nextId++;
        while (this.nodes.some(node => node.id === id)) id = "node-" + this.nextId++;
        const previous = this.nodes.slice();
        const name = kind === "preset" ? "Preset: " + (Core.Presets.Get(preset!)?.name ?? preset) : kind === "hideUnitFrame" ? "Hide native unit frame" : kind === "fragment" ? "Headless group" : kind === "flow" ? "Flow" : kind === "cell" ? "Cell" : kind === "progress" ? "Progress" : "Action";
        this.nodes.push({ id, parent: parent.id, kind, name: name + " " + id.slice(5),
            width: kind === "flow" || kind === "cell" ? 140 : kind === "progress" ? 180 : 32,
            height: kind === "flow" || kind === "cell" ? 80 : 32, direction: "vertical", preset,
            ...(kind === "preset" || kind === "fragment" ? { props: {} } : kind === "hideUnitFrame" ? { props: { unit: "player" } } : {}) });
        try { this.Document(); } catch (failure) { this.nodes = previous; this.Report(String(failure)); return; }
        this.selected = id;
        this.treeScroll = Math.max(0, this.Tree().findIndex(item => item.node.id === id) * 32 - 128);
        this.Changed("Element added.");
    }

    public Remove(): void {
        const node = this.Selected;
        if (node === this.nodes[0]) { this.message = "The root layout stays in the draft."; Core.RefreshCustomization(); return; }
        const removed = new Set<string>([node.id]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const child of this.nodes) if (removed.has(child.parent) && !removed.has(child.id)) {
                removed.add(child.id);
                changed = true;
            }
        }
        this.nodes = this.nodes.filter(child => !removed.has(child.id));
        this.selected = node.parent;
        this.Changed("Element removed.");
    }

    public Resize(axis: "width" | "height", amount: number): void {
        this.Selected[axis] = Math.max(16, Math.min(axis === "width" ? 800 : 600, this.Selected[axis] + amount));
        (this.Selected.props ??= {})[axis] = this.Selected[axis];
        this.Changed("Size updated.");
    }
    public ToggleDirection(): void {
        const node = this.Selected;
        node.direction = node.direction === "vertical" ? "horizontal" : "vertical";
        (node.props ??= {}).direction = node.direction;
        this.Changed("Flow direction updated.");
    }
    private Changed(message: string): void { this.dirty = true; this.message = message; Core.RefreshCustomization(); }

    public Save(): void {
        Core.Store.set(EditorSettings, settings => {
            settings.nodes = this.nodes.map(node => ({ ...node }));
            settings.dependencies = this.dependencies;
            settings.nextId = this.nextId;
            settings.documentId = this.documentId;
            settings.documentName = this.documentName;
            settings.owner = this.owner;
            settings.sources = this.sources.map(source => ({ ...source, props: { ...source.props } }));
            return settings;
        });
        this.dirty = false;
        this.message = "Draft saved for this character.";
        Core.RefreshCustomization();
    }
    public New(headless = false): void {
        let index = 1;
        while (Core.Presets.Get("collection-" + index) !== undefined) index++;
        this.documentId = "collection-" + index; this.documentName = "Collection " + index; this.owner = undefined;
        this.inspector = "properties"; this.propertyEditor.nodeId = "";
        this.nodes = [headless ? { ...rootNode(), kind: "fragment", name: "Headless group", props: {} } : rootNode()]; this.sources = []; this.dependencies = []; this.nextId = 1; this.selected = "root"; this.treeScroll = 0;
        this.Changed("New collection draft. Apply to save and mount it.");
    }
    public Document(): PresetDocument {
        const build = (node: EditorNode): PresetNode => {
            const kind = node.kind === "action" ? "secureButton" : node.kind;
            const props: Properties = {
                ...(node.props === undefined && !["fragment", "preset", "hideUnitFrame"].includes(kind) ? { width: node.width, height: node.height,
                    ...(kind === "flow" ? { direction: node.direction } : {}) } : {}),
                ...(kind === "progress" ? { ...(node.source === undefined ? { current: 65, min: 0, max: 100 } : {}), color: { ...Core.Theme.colors.accent } } : {}),
                ...node.props };
            if (node.id === this.nodes[0].id && !["fragment", "preset", "hideUnitFrame"].includes(kind) && props.mode === undefined) {
                props.mode = "absolute"; props.anchor = "CENTER"; props.relativeAnchor = "CENTER"; props.x = 0; props.y = 0;
            }
            return { id: node.id, type: kind, props, ...(node.preset === undefined ? {} : { preset: node.preset }), ...(node.source === undefined ? {} : { source: node.source }),
                ...(node.sourcePath === undefined ? {} : { sourcePath: node.sourcePath }),
                ...(node.visibleSource === undefined ? {} : { visibleSource: node.visibleSource }),
                ...(node.textSource === undefined ? {} : { textSource: node.textSource }),
                ...(node.alphaSource === undefined ? {} : { alphaSource: node.alphaSource }),
                children: this.Children(node.id).map(build) };
        };
        return Core.Presets.Validate({ version: 1, kind: "preset", id: this.documentId, name: this.documentName, ...(this.owner === undefined ? {} : { owner: this.owner }),
            sources: this.sources, root: build(this.nodes[0]), ...(this.dependencies.length === 0 ? {} : { dependencies: this.Dependencies() }) });
    }
    private Dependencies(root?: PresetNode): PresetDocument[] {
        const found = new Map<string, PresetDocument>();
        const visit = (node: PresetNode) => {
            if (node.preset !== undefined && !found.has(node.preset)) {
                const doc = this.dependencies.find(item => item.id === node.preset);
                if (doc !== undefined) { found.set(doc.id, doc); visit(doc.root); }
            }
            for (const child of node.children ?? []) visit(child);
        };
        if (root !== undefined) visit(root);
        else for (const node of this.nodes) if (node.preset !== undefined) visit({ id: node.id, type: "preset", preset: node.preset, props: {} });
        return Array.from(found.values());
    }
    public Load(input: PresetDocument): void {
        const document = Core.Presets.Validate(input);
        const nodes: EditorNode[] = [];
        const visit = (node: PresetNode, parent: string) => {
            nodes.push({ id: node.id, parent, kind: node.type === "secureButton" ? "action" : node.type, name: node.type + " " + node.id,
                width: typeof node.props.width === "number" ? node.props.width : 140,
                height: typeof node.props.height === "number" ? node.props.height : 32,
                direction: node.props.direction === "horizontal" ? "horizontal" : "vertical", props: node.props, source: node.source, sourcePath: node.sourcePath, visibleSource: node.visibleSource, textSource: node.textSource, alphaSource: node.alphaSource, preset: node.preset });
            for (const child of node.children ?? []) visit(child, node.id);
        };
        visit(document.root, "");
        this.inspector = "properties";
        this.nodes = nodes; this.dependencies = document.dependencies ?? []; this.sources = document.sources; this.documentId = document.id; this.documentName = document.name; this.owner = document.owner;
        this.selected = nodes[0].id; this.treeScroll = 0; this.nextId = 1;
        this.Changed("Preset imported into the draft. Apply to mount it.");
    }
    public UseResource(type: "hp" | "mana" | undefined): void {
        const node = this.Selected;
        if (node.kind !== "progress") return;
        if (type === undefined) delete node.source;
        else {
            const matching = this.sources.find(source => source.type === type && source.props.unit === "player");
            let name = matching?.name ?? "player." + type;
            let suffix = 1;
            while (matching === undefined && this.sources.some(source => source.name === name)) name = "player." + type + "." + suffix++;
            if (matching === undefined) this.sources.push({ name, type, props: { unit: "player" } });
            node.source = name;
            if (node.props !== undefined) { delete node.props.current; delete node.props.min; delete node.props.max; }
        }
        this.Changed("Source binding updated.");
    }
    public UseSpell(value: string): void {
        const id = Number(value);
        if (!Number.isInteger(id) || id < 1 || id > 10000000) { this.message = "Enter a valid spell ID."; Core.RefreshCustomization(); return; }
        const matching = this.sources.find(source => source.type === "spell" && source.props.spellId === id);
        let name = matching?.name ?? "spell." + id;
        let suffix = 1;
        while (matching === undefined && this.sources.some(source => source.name === name)) name = "spell." + id + "." + suffix++;
        if (matching === undefined) this.sources.push({ name, type: "spell", props: { spellId: id } });
        this.Selected.source = name;
        if (this.Selected.kind === "action") {
            const child = this.Children(this.Selected.id)[0];
            if (child === undefined) {
                let childId = "node-" + this.nextId++;
                while (this.nodes.some(node => node.id === childId)) childId = "node-" + this.nextId++;
                this.nodes.push({ id: childId, parent: this.Selected.id, kind: "icon", name: "Spell icon", width: this.Selected.width,
                    height: this.Selected.height, direction: "vertical", props: { width: "inherit", height: "inherit" }, source: name });
            } else if (child.kind === "icon") child.source = name;
        }
        this.Changed("Spell source bound. Action previews remain non-interactive.");
    }
    public Apply(): void {
        try { const document = this.Document(); Core.Presets.Mount(document); Core.Presets.Save(document, true); this.dependencies = []; this.Save();
            this.message = "Preset mounted and enabled for this character."; }
        catch (failure) { this.message = String(failure); }
        Core.RefreshCustomization();
    }
    public Export(): void { try { Core.OpenExport(this.Document()); } catch (failure) { this.message = String(failure); Core.RefreshCustomization(); } }
    public Import(): void { Core.OpenImport("preset", document => { if (document.kind === "preset") this.Load(document); }); }

}
