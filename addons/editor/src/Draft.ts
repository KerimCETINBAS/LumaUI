import { Store } from "wuira/store";
import type { PresetDocument, PresetNode, SourceSpec, Properties, ActivationMode, CollectionClass, CollectionCondition } from "lumaui/core";
import { PropertyEditor } from "./PropertyEditor";
import { SourceEditor, BindingField } from "./SourceEditor";
import { Core } from "./core";
import { elementDefaults, elementLabel } from "./ElementCatalog";

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
    items?: string;
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
    public activationMode: ActivationMode = "condMet";
    public collectionClass: CollectionClass | "" = "";
    public collectionCondition: CollectionCondition | "" = "";
    public nativeLayout = "";
    public layoutPositions?: PresetDocument["layoutPositions"];
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
    public renaming = false;
    public renameValue = "";
    private renameInput?: () => string;
    public componentFilter = "";
    public StartRename(): void { this.propertyEditor.Flush(); this.sourceEditor.Flush(); this.renameValue = this.documentName; this.renaming = true; Core.RefreshCustomization(); }
    public CancelRename(): void { this.renaming = false; this.renameInput = undefined; Core.RefreshCustomization(); }
    public CaptureRename(read: () => string): () => void { this.renameInput = read; return () => { if (this.renameInput === read) { this.renameValue = read(); this.renameInput = undefined; } }; }
    public Rename(value = this.renameInput?.() ?? this.renameValue): boolean {
        try { const document = Core.Presets.Validate({ ...this.Document(), name: value.trim() }); this.documentName = document.name; this.renameValue = document.name; this.renaming = false; this.Changed("Component renamed. Save to update the library."); return true; }
        catch (failure) { this.renameValue = value; this.Report(String(failure)); return false; }
    }
    public owner?: string;
    public activationMode: ActivationMode = "condMet";
    public collectionClass: CollectionClass | "" = "";
    public collectionCondition: CollectionCondition | "" = "";
    public nativeLayout = "";
    public layoutPositions?: PresetDocument["layoutPositions"];
    public sources: SourceSpec[];
    public dependencies: PresetDocument[] = [];
    public selected = "root";
    public inspector: "properties" | "sources" | "collection" = "properties";
    public readonly propertyEditor = new PropertyEditor(this);
    public readonly sourceEditor = new SourceEditor(this);
    public SetInspector(tab: "properties" | "sources" | "collection"): void {
        this.sourceEditor.Flush(); this.propertyEditor.Flush(); this.inspector = tab;
        if (tab === "sources") this.sourceEditor.Open(this.Selected.source ?? this.sources[0]?.name);
        else Core.RefreshCustomization();
    }
    public UpdateProperties(props: Properties, bindingPath?: string, items?: string): void {
        const node = this.Selected; const oldProps = node.props, oldPath = node.sourcePath, oldSource = node.source, oldItems = node.items; node.props = props;
        if (bindingPath !== undefined && node.source !== undefined) { if (bindingPath.trim() === "") delete node.sourcePath; else node.sourcePath = bindingPath.trim(); }
        if (items !== undefined && node.kind === "foreach") { node.items = items.trim(); delete node.source; delete node.sourcePath; }
        try { const preview = Core.Presets.Preview(this.Document()); preview.Dispose(); }
        catch (failure) { node.props = oldProps; node.sourcePath = oldPath; node.source = oldSource; node.items = oldItems; throw failure; }
        if (typeof props.width === "number") node.width = props.width;
        if (typeof props.height === "number") node.height = props.height;
        if (props.direction === "horizontal" || props.direction === "vertical") node.direction = props.direction;
        this.Changed("Properties updated. Save to update the mounted component.");
    }
    public Report(message: string): void { this.message = message; Core.RefreshCustomization(); }
    public UpdateSources(sources: SourceSpec[]): void {
        const document = Core.Presets.Validate({ ...this.Document(), sources });
        const preview = Core.Presets.Preview(document); preview.Dispose();
        this.sources = document.sources; this.Changed("Sources updated. Save to update the mounted component.");
    }
    public BindSource(name: string | undefined, field: BindingField, path?: string): void {
        const node = this.Selected; const previousItems = node.items; const previous = node[field]; const oldProps = node.props; const previousPath = node.sourcePath; const previousNodes = this.nodes; const previousId = this.nextId;
        if (name === undefined) delete node[field]; else { node[field] = name; if (field === "source" && node.kind === "foreach") delete node.items; }
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
        catch (failure) { this.nodes = previousNodes; this.nextId = previousId; if (previousItems === undefined) delete node.items; else node.items = previousItems; if (previous === undefined) delete node[field]; else node[field] = previous; node.props = oldProps; if (previousPath === undefined) delete node.sourcePath; else node.sourcePath = previousPath; this.Report(String(failure)); return; }
        this.Changed("Source binding updated.");
    }
    public BindItems(expression: string): void {
        const node = this.Selected; if (node.kind !== "foreach") return;
        const previous = { items: node.items, source: node.source, sourcePath: node.sourcePath };
        try {
            Core.Presets.ParseItems(expression);
            node.items = expression.trim(); delete node.source; delete node.sourcePath;
            const preview = Core.Presets.Preview(this.Document()); preview.Dispose();
        } catch (failure) { node.items = previous.items; node.source = previous.source; node.sourcePath = previous.sourcePath; this.Report(String(failure)); return; }
        this.Changed("List helper updated. The item template receives each result as item.");
    }
    public InItemTemplate(): boolean {
        let node = this.nodes.find(item => item.id === this.Selected.parent);
        while (node !== undefined) { if (node.kind === "foreach") return true; node = this.nodes.find(item => item.id === node!.parent); }
        return false;
    }
    public collectionScroll = 0;
    public treeScroll = 0;
    public treeViewportHeight = 0;
    public readonly collapsed = new Set<string>();
    public workspaceView: "design" | "preview" | "hierarchy" | "inspector" = "design";
    public toolbox = "layout";
    public SetWorkspace(view: EditorDraft["workspaceView"]): void { this.propertyEditor.Flush(); this.sourceEditor.Flush(); this.workspaceView = view; Core.RefreshCustomization(); }
    public SetToolbox(group: string): void { this.propertyEditor.Flush(); this.sourceEditor.Flush(); this.toolbox = group; Core.RefreshCustomization(); }
    public CanContain(node: EditorNode): boolean {
        return Core.Presets.ComponentChildren(node.kind === "action" ? "secureButton" : node.kind) !== "none";
    }
    private ChildError(parent: EditorNode, visual: boolean, exclude?: string): string | undefined {
        const children = this.Children(parent.id).filter(child => child.id !== exclude);
        if (parent.kind === "foreach" && children.length >= 2) return "A repeated list has one member template and an optional pet template. Add elements inside a template.";
        const count = Core.Presets.ComponentChildren(parent.kind === "action" ? "secureButton" : parent.kind);
        if (count === "single" && visual && children.some(child => this.IsVisual(child))) return "This element accepts one child. Use a layout.";
        return undefined;
    }
    private InMemberTemplate(node: EditorNode): boolean {
        let parent = this.nodes.find(item => item.id === node.parent);
        while (parent !== undefined) {
            if (parent.kind === "foreach") return this.sources.find(source => source.name === parent!.source)?.type === "groupMembers";
            parent = this.nodes.find(item => item.id === parent!.parent);
        }
        return false;
    }
    private ListTemplate(parent: string, id: string): EditorNode {
        return { id, parent, kind: "cell", name: "Member template", width: 180, height: 72, direction: "vertical",
            props: { width: 180, height: 72, backgroundColor: { ...Core.Theme.colors.surface }, borderColor: { ...Core.Theme.colors.border }, borderWidth: 1 } };
    }
    public DropError(id: string, targetId: string, position: "before" | "inside" | "after"): string | undefined {
        const source = this.nodes.find(node => node.id === id), target = this.nodes.find(node => node.id === targetId);
        if (source === undefined || target === undefined) return "Element not found.";
        if (source === this.nodes[0]) return "The root cannot be moved.";
        if (source === target) return "Choose another element.";
        let cursor: EditorNode | undefined = target;
        while (cursor !== undefined) { if (cursor.id === id) return "An element cannot contain itself."; cursor = this.nodes.find(node => node.id === cursor!.parent); }
        const parent = position === "inside" ? target : this.nodes.find(node => node.id === target.parent);
        if (parent === undefined || !this.CanContain(parent)) return "Drop into a container.";
        return this.ChildError(parent, this.IsVisual(source), id);
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
        this.selected = id; this.Reveal(id); this.ScrollToSelection(); this.Changed("Element moved. Save to update the mounted component.");
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
        this.activationMode = saved.activationMode;
        this.collectionClass = saved.collectionClass;
        this.collectionCondition = saved.collectionCondition;
        this.nativeLayout = saved.nativeLayout; this.layoutPositions = saved.layoutPositions;
        this.dependencies = saved.dependencies ?? [];
        this.sources = saved.sources.map(source => ({ ...source, props: { ...source.props } }));
        this.selected = this.nodes[0].id; this.ResetTree();
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

    public VisibleTree(): { node: EditorNode; depth: number }[] {
        return this.Tree().filter(entry => this.Path(entry.node.id).slice(0, -1).every(node => !this.collapsed.has(node.id)));
    }
    public Path(id = this.selected): EditorNode[] {
        const path: EditorNode[] = [];
        let node = this.nodes.find(node => node.id === id);
        while (node !== undefined) { path.unshift(node); node = this.nodes.find(parent => parent.id === node!.parent); }
        return path;
    }
    private ResetTree(): void {
        this.collapsed.clear();
        for (const entry of this.Tree()) if (entry.depth >= 2 && this.Children(entry.node.id).length > 0) this.collapsed.add(entry.node.id);
    }
    private Reveal(id: string): void { for (const node of this.Path(id).slice(0, -1)) this.collapsed.delete(node.id); }
    private ScrollToSelection(): void {
        const index = this.VisibleTree().findIndex(entry => entry.node.id === this.selected), top = index * 36;
        if (index < 0 || this.treeViewportHeight <= 0) return;
        if (top < this.treeScroll) this.treeScroll = top;
        else if (top + 34 > this.treeScroll + this.treeViewportHeight) this.treeScroll = top + 34 - this.treeViewportHeight;
    }
    public ToggleExpanded(id: string): void {
        if (this.Children(id).length === 0) return;
        this.propertyEditor.Flush(); this.sourceEditor.Flush();
        if (this.collapsed.has(id)) this.collapsed.delete(id);
        else {
            this.collapsed.add(id);
            if (this.Path().slice(0, -1).some(node => node.id === id)) { this.propertyEditor.Flush(); this.sourceEditor.Flush(); this.selected = id; }
        }
        Core.RefreshCustomization();
    }
    public ExpandAll(expand: boolean): void {
        this.propertyEditor.Flush(); this.sourceEditor.Flush();
        this.collapsed.clear();
        if (!expand) { for (const node of this.nodes) if (node !== this.nodes[0] && this.Children(node.id).length > 0) this.collapsed.add(node.id); this.Select(this.nodes[0].id); this.treeScroll = 0; }
        Core.RefreshCustomization();
    }
    public Select(id: string): void {
        if (this.selected === id || !this.nodes.some(node => node.id === id)) return;
        if (this.propertyEditor.HasChanges && !this.propertyEditor.Save()) return;
        this.sourceEditor.Flush(); this.propertyEditor.Flush();
        this.selected = id; this.Reveal(id); this.ScrollToSelection();
        Core.RefreshCustomization();
    }

    public IsVisual(node: EditorNode): boolean {
        if (["hideUnitFrame", "hideActionBars"].includes(node.kind)) return false;
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
        try { this.Document(); this.Changed("Component reference updated."); } catch (failure) { this.Selected.preset = old; this.Report(String(failure)); }
    }
    public Add(kind: NodeKind, preset?: string): void {
        this.propertyEditor.Flush(); this.sourceEditor.Flush();
        let parent = this.Selected;
        while (!this.CanContain(parent)) {
            const ancestor = this.nodes.find(node => node.id === parent.parent);
            if (ancestor === undefined) { this.Report("Select a container with room for another child."); return; }
            parent = ancestor;
        }
        const visual = !["hideUnitFrame", "hideActionBars", "fragment"].includes(kind) && (kind !== "preset" || !Core.Presets.IsHeadless(Core.Presets.Get(preset!)!));
        const reason = this.ChildError(parent, visual);
        if (reason !== undefined) { this.Report(reason); return; }
        const previous = this.nodes.slice(), previousSources = this.sources.slice(), previousId = this.nextId;
        const next = () => { let id = "node-" + this.nextId++; while (this.nodes.some(node => node.id === id)) id = "node-" + this.nextId++; return id; };
        const id = next();
        const unit = (parent.kind === "foreach" && this.sources.find(source => source.name === parent.source)?.type === "groupMembers") || this.InMemberTemplate(parent) ? "$unit" : "player";
        const defaults = elementDefaults(kind, unit);
        const name = kind === "preset" ? "Component: " + (Core.Presets.Get(preset!)?.name ?? preset) : elementLabel(kind);
        const node: EditorNode = { id, parent: parent.id, kind, name, ...defaults, direction: "vertical", preset };
        this.nodes.push(node);
        if (kind === "foreach") {
            let source = this.sources.find(source => source.type === "groupMembers");
            if (source === undefined) {
                let name = "members", n = 1; while (this.sources.some(source => source.name === name)) name = "members-" + n++;
                source = { name, type: "groupMembers", props: { scope: "auto" } }; this.sources.push(source);
            }
            node.source = source.name; this.nodes.push(this.ListTemplate(id, next()));
        }
        try { this.Document(); }
        catch (failure) { this.nodes = previous; this.sources = previousSources; this.nextId = previousId; this.Report(String(failure)); return; }
        this.selected = id; this.propertyEditor.nodeId = "";
        this.treeScroll = Math.max(0, this.Tree().findIndex(item => item.node.id === id) * 32 - 128);
        this.Changed("Element added.");
    }

    public Remove(): void {
        const node = this.Selected;
        if (node === this.nodes[0]) { this.message = "The root layout stays in the draft."; Core.RefreshCustomization(); return; }
        const parent = this.nodes.find(item => item.id === node.parent);
        if (parent?.kind === "foreach" && this.Children(parent.id).length === 1) {
            this.Report("Keep one member template in the repeated list. Edit its contents or delete the list instead."); return;
        }
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
    private Changed(message: string): void { this.Reveal(this.selected); this.dirty = true; this.message = message; Core.RefreshCustomization(); }

    public Save(): void {
        Core.Store.set(EditorSettings, settings => {
            settings.nodes = this.nodes.map(node => ({ ...node }));
            settings.dependencies = this.dependencies;
            settings.nextId = this.nextId;
            settings.documentId = this.documentId;
            settings.documentName = this.documentName;
            settings.owner = this.owner;
            settings.activationMode = this.activationMode;
            settings.collectionClass = this.collectionClass;
            settings.collectionCondition = this.collectionCondition;
            settings.nativeLayout = this.nativeLayout; settings.layoutPositions = this.layoutPositions;
            settings.sources = this.sources.map(source => ({ ...source, props: { ...source.props } }));
            return settings;
        });
        this.dirty = false;
        this.message = "Draft saved for this character.";
        Core.RefreshCustomization();
    }
    public New(headless = false, scope?: "party" | "raid" | "spells"): void {
        let index = 1;
        while (Core.Presets.Get("collection-" + index) !== undefined) index++;
        this.documentId = "collection-" + index; this.documentName = "Component " + index; this.owner = undefined;
        this.activationMode = "condMet"; this.collectionClass = ""; this.collectionCondition = ""; this.nativeLayout = ""; this.layoutPositions = undefined;
        this.inspector = "properties"; this.propertyEditor.nodeId = "";
        this.nodes = [headless ? { ...rootNode(), kind: "fragment", name: "Headless group", props: {} } : rootNode()]; this.sources = []; this.dependencies = []; this.nextId = 1; this.selected = "root"; this.treeScroll = 0;
        if (scope !== undefined && scope !== "spells") {
            this.documentName = scope === "party" ? "Party frames " + index : "Raid frames " + index;
            this.collectionCondition = scope === "party" ? "inParty" : "inRaid";
            this.sources = [{ name: "members", type: "groupMembers", props: { scope } }];
            this.nodes = [{ id: "root", parent: "", kind: "foreach", name: "Members", ...elementDefaults("foreach", "player"),
                direction: "vertical", source: "members" }, this.ListTemplate("root", "member")];
            if (scope === "raid") this.nodes[0].props!.groupBy = "group";
        }
        if (scope === "spells") {
            this.documentName = "Spell buttons " + index;
            this.nodes = [{ id: "root", parent: "", kind: "foreach", name: "Known spells", width: 0, height: 0, direction: "horizontal", items: "KnownSpells()",
                props: { width: 0, height: 0, direction: "horizontal", wrapAfter: 8, gap: 4, lineGap: 4 } },
                { id: "spell", parent: "root", kind: "action", name: "Spell button template", width: 24, height: 24, direction: "vertical", source: "item", props: { width: 24, height: 24, finishGlow: true } },
                { id: "icon", parent: "spell", kind: "icon", name: "Spell icon", width: 24, height: 24, direction: "vertical", source: "item", props: { width: "inherit", height: "inherit" } }];
        }
        this.ResetTree(); this.sourceEditor.Reset(); this.renaming = false; this.renameInput = undefined;
        this.Changed(scope === undefined ? "New component draft. Save to save and mount it." : scope === "spells" ? "Edit one button template. KnownSpells filters the list; item supplies each spell, icon and cooldown." : "Edit the member template. The list repeats it for each unit; use $unit in sources and unit fields.");
    }
    public Document(): PresetDocument {
        const build = (node: EditorNode): PresetNode => {
            const kind = node.kind === "action" ? "secureButton" : node.kind;
            const props: Properties = {
                ...(node.props === undefined && !["fragment", "preset", "hideUnitFrame", "hideActionBars"].includes(kind) ? { width: node.width, height: node.height,
                    ...(kind === "flow" ? { direction: node.direction } : {}) } : {}),
                ...(kind === "progress" ? { ...(node.source === undefined ? { current: 65, min: 0, max: 100 } : {}), color: { ...Core.Theme.colors.accent } } : {}),
                ...node.props };
            if (node.id === this.nodes[0].id && !["fragment", "preset", "hideUnitFrame", "hideActionBars"].includes(kind) && props.mode === undefined) {
                props.mode = "absolute"; props.anchor = "CENTER"; props.relativeAnchor = "CENTER"; props.x = 0; props.y = 0;
            }
            return { id: node.id, type: kind, props, ...(node.preset === undefined ? {} : { preset: node.preset }), ...(node.source === undefined ? {} : { source: node.source }),
                ...(node.items === undefined ? {} : { items: node.items }),
                ...(node.sourcePath === undefined ? {} : { sourcePath: node.sourcePath }),
                ...(node.visibleSource === undefined ? {} : { visibleSource: node.visibleSource }),
                ...(node.textSource === undefined ? {} : { textSource: node.textSource }),
                ...(node.alphaSource === undefined ? {} : { alphaSource: node.alphaSource }),
                children: this.Children(node.id).map(build) };
        };
        return Core.Presets.Validate({ version: 1, kind: "preset", id: this.documentId, name: this.documentName,
            enabled: this.activationMode, ...(this.collectionClass === "" ? {} : { class: this.collectionClass }),
            ...(this.collectionCondition === "" ? {} : { condition: this.collectionCondition }), ...(this.owner === undefined ? {} : { owner: this.owner }),
            ...(this.nativeLayout === "" ? {} : { layout: this.nativeLayout }), ...(this.layoutPositions === undefined ? {} : { layoutPositions: this.layoutPositions }),
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
    public Open(id: string): void {
        const document = Core.Presets.Get(id);
        if (document === undefined) { this.Report("Component not found: " + id); return; }
        this.Load(document);
    }
    public Load(input: PresetDocument): void {
        const document = Core.Presets.Validate(input);
        const nodes: EditorNode[] = [];
        const visit = (node: PresetNode, parent: string) => {
            nodes.push({ id: node.id, parent, kind: node.type === "secureButton" ? "action" : node.type, name: node.type + " " + node.id,
                width: typeof node.props.width === "number" ? node.props.width : 140,
                height: typeof node.props.height === "number" ? node.props.height : 32,
                direction: node.props.direction === "horizontal" ? "horizontal" : "vertical", props: node.props, source: node.source, items: node.items, sourcePath: node.sourcePath, visibleSource: node.visibleSource, textSource: node.textSource, alphaSource: node.alphaSource, preset: node.preset });
            for (const child of node.children ?? []) visit(child, node.id);
        };
        visit(document.root, "");
        this.inspector = "properties";
        this.nodes = nodes; this.dependencies = document.dependencies ?? []; this.sources = document.sources; this.documentId = document.id; this.documentName = document.name; this.owner = document.owner;
        this.activationMode = document.enabled ?? "condMet"; this.collectionClass = document.class ?? ""; this.collectionCondition = document.condition ?? "";
        this.nativeLayout = document.layout ?? ""; this.layoutPositions = document.layoutPositions;
        this.selected = nodes[0].id; this.treeScroll = 0; this.nextId = 1; this.propertyEditor.nodeId = "";
        this.ResetTree(); this.sourceEditor.Reset(); this.renaming = false; this.renameInput = undefined;
        this.Changed("Component loaded into the draft. Save to update it in the game.");
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
    public UpdateActivation(patch: { enabled?: ActivationMode; class?: CollectionClass | ""; condition?: CollectionCondition | ""; layout?: string }): void {
        const document = this.Document();
        if (patch.enabled !== undefined) document.enabled = patch.enabled;
        if (patch.class !== undefined) { if (patch.class === "") delete document.class; else document.class = patch.class; }
        if (patch.condition !== undefined) { if (patch.condition === "") delete document.condition; else document.condition = patch.condition; }
        if (patch.layout !== undefined) { if (patch.layout === "") delete document.layout; else document.layout = patch.layout; }
        const validated = Core.Presets.Validate(document);
        this.activationMode = validated.enabled ?? "condMet"; this.collectionClass = validated.class ?? ""; this.collectionCondition = validated.condition ?? ""; this.nativeLayout = validated.layout ?? "";
        this.Changed("Component activation updated. Save to update it in the game.");
    }
    public Commit(): void {
        if (this.renaming && !this.Rename()) return;
        if (this.sourceEditor.HasChanges && !this.sourceEditor.Save()) return;
        this.propertyEditor.Ensure();
        if (this.propertyEditor.HasChanges && !this.propertyEditor.Save()) return;
        this.Apply();
    }
    public Apply(): void {
        try { const document = this.Document(); Core.Presets.Apply(document); this.dependencies = []; this.Save();
            this.message = "Component saved · " + Core.Presets.ActivationStatus(this.documentId) + "."; }
        catch (failure) { this.message = String(failure); }
        Core.RefreshCustomization();
    }
    public Export(): void { try { Core.OpenExport(this.Document()); } catch (failure) { this.message = String(failure); Core.RefreshCustomization(); } }
    public Import(): void { Core.OpenImport("preset", document => { if (document.kind === "preset") this.Load(document); }); }

}
