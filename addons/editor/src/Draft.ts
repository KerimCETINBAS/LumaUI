import { EditHistory, cloneData, equalData } from "./EditHistory";
import { Store } from "wuira/store";
import type { PresetDocument, PresetNode, SourceSpec, Properties, ActivationMode, CollectionClass, CollectionCondition } from "lumaui/core";
import { PropertyEditor } from "./PropertyEditor";
import { SourceEditor, BindingField } from "./SourceEditor";
import { Core } from "./core";
import { elementDefaults, elementLabel } from "./ElementCatalog";

export type NodeKind = string;
export interface EditorNode {
    activation?: PresetNode["activation"];
    sourceProps?: PresetNode["sourceProps"];
    bindings?: PresetNode["bindings"];
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

type DraftSnapshot = Pick<EditorDraft, "nodes" | "sources" | "dependencies" | "nextId" | "documentId" | "documentName" | "owner" | "activationMode" | "collectionClass" | "collectionCondition" | "nativeLayout" | "layoutPositions" | "selected">;
function sameDraft(a: DraftSnapshot, b: DraftSnapshot): boolean { return equalData({ ...a, selected: "" }, { ...b, selected: "" }); }
/** Session draft backed by the same preset format used by the master runtime. */
export class EditorDraft {
    public nodes: EditorNode[];
    public nextId: number;
    public documentId: string;
    public documentName: string;
    public identityPrompt?: { id: string; name: string; duplicate: boolean; rename: boolean };
    public renaming = false;
    public renameValue = "";
    private renameInput?: () => string;
    public componentFilter = "";
    public StartRename(): void { this.propertyEditor.Flush(); this.sourceEditor.Flush(); this.renameValue = this.documentName; this.renaming = true; Core.RefreshCustomization(); }
    public CancelRename(): void { this.renaming = false; this.renameInput = undefined; Core.RefreshCustomization(); }
    public CaptureRename(read: () => string): () => void { this.renameInput = read; return () => { if (this.renameInput === read) { this.renameValue = read(); this.renameInput = undefined; } }; }
    public Rename(value = this.renameInput?.() ?? this.renameValue): boolean {
        try { const document = Core.Presets.Validate({ ...this.Document(), name: value.trim() }, true); this.documentName = document.name; this.renameValue = document.name; this.renaming = false; this.Changed("Component renamed. Save to update the library."); return true; }
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
    public previewZoom: import("lumaui/core").PreviewZoom = 1;
    private readonly history = new EditHistory<DraftSnapshot>(sameDraft);
    private savedState?: DraftSnapshot;
    private Snapshot(): DraftSnapshot {
        return cloneData({ nodes: this.nodes, sources: this.sources, dependencies: this.dependencies, nextId: this.nextId,
            documentId: this.documentId, documentName: this.documentName, owner: this.owner, activationMode: this.activationMode,
            collectionClass: this.collectionClass, collectionCondition: this.collectionCondition, nativeLayout: this.nativeLayout,
            layoutPositions: this.layoutPositions, selected: this.selected });
    }
    public get HasUnsavedChanges(): boolean { return this.dirty || this.propertyEditor.HasChanges || this.sourceEditor.HasChanges || this.renaming && (this.renameInput?.() ?? this.renameValue).trim() !== this.documentName; }
    private get PendingRename(): boolean { return this.renaming && (this.renameInput?.() ?? this.renameValue).trim() !== this.documentName; }
    public get CanUndo(): boolean { return this.history.CanUndo || this.propertyEditor.HasChanges || this.sourceEditor.HasChanges || this.PendingRename; }
    public get CanRedo(): boolean { return this.history.CanRedo && !this.propertyEditor.HasChanges && !this.sourceEditor.HasChanges && !this.PendingRename; }
    public Suspend(): void { this.propertyEditor.Flush(); this.sourceEditor.Flush(); if (this.renaming && this.renameInput !== undefined) this.renameValue = this.renameInput(); }
    private StageEdits(): boolean {
        if (this.renaming && !this.Rename()) return false;
        if (this.sourceEditor.HasChanges && !this.sourceEditor.SaveAll()) return false;
        this.propertyEditor.Ensure();
        return !this.propertyEditor.HasChanges || this.propertyEditor.Save();
    }
    private RestoreSnapshot(snapshot: DraftSnapshot): void {
        const source = this.sourceEditor.original;
        Object.assign(this, cloneData(snapshot));
        this.renaming = false; this.renameInput = undefined; this.propertyEditor.Open(); this.sourceEditor.Reset();
        if (this.inspector === "sources") this.sourceEditor.Open(this.sources.find(item => item.name === source)?.name ?? this.sources[0]?.name);
        this.Reveal(this.selected); this.ScrollToSelection();
        this.dirty = this.savedState === undefined || !sameDraft(this.Snapshot(), this.savedState);
        Core.RefreshCustomization();
    }
    public Undo(): void {
        if (InCombatLockdown() || !this.StageEdits()) return;
        const snapshot = this.history.Undo(); if (snapshot === undefined) return;
        this.RestoreSnapshot(snapshot); this.message = "Change undone. Redo restores it.";
    }
    public Redo(): void {
        if (InCombatLockdown() || !this.CanRedo) return;
        const snapshot = this.history.Redo(); if (snapshot === undefined) return;
        this.RestoreSnapshot(snapshot); this.message = "Change redone.";
    }
    public SetInspector(tab: "properties" | "sources" | "collection"): void {
        this.sourceEditor.Flush(); this.propertyEditor.Flush(); this.inspector = tab;
        if (tab === "sources" && !this.sourceEditor.HasChanges) this.sourceEditor.Open(this.Selected.source ?? this.sources[0]?.name);
        else Core.RefreshCustomization();
    }
    public UpdateProperties(props: Properties, bindingPath?: string, items?: string, bindings?: PresetNode["bindings"]): void {
        const node = this.Selected; const oldProps = node.props, oldPath = node.sourcePath, oldSource = node.source, oldItems = node.items, oldBindings = node.bindings; node.props = props;
        if (bindings !== undefined) node.bindings = Object.keys(bindings).length === 0 ? undefined : bindings;
        if (bindingPath !== undefined && node.source !== undefined) { if (bindingPath.trim() === "") delete node.sourcePath; else node.sourcePath = bindingPath.trim(); }
        if (items !== undefined && node.kind === "foreach") { node.items = items.trim(); delete node.source; delete node.sourcePath; }
        try { const preview = Core.Presets.Preview(this.Document()); preview.Dispose(); }
        catch (failure) { node.props = oldProps; node.sourcePath = oldPath; node.source = oldSource; node.items = oldItems; node.bindings = oldBindings; throw failure; }
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
    public BindProperty(target: string, source?: string, path?: string): void {
        this.propertyEditor.Flush(); this.sourceEditor.Flush();
        const node = this.Selected, previous = node.bindings, previousAlpha = node.alphaSource;
        if (target === "alpha") delete node.alphaSource;
        const next = { ...previous };
        if (source === undefined) delete next[target]; else next[target] = { source, ...(path?.trim() ? { path: path.trim() } : {}) };
        node.bindings = Object.keys(next).length === 0 ? undefined : next;
        try { const preview = Core.Presets.Preview(this.Document()); preview.Dispose(); }
        catch (failure) { node.bindings = previous; node.alphaSource = previousAlpha; this.Report(String(failure)); return; }
        this.Changed("Property source updated. Save to update the mounted component.");
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
        if (node.kind === "blizzardElement") return node.props?.replace === true;
        return Core.Presets.ComponentChildren(node.kind === "action" ? "secureButton" : node.kind) !== "none";
    }
    private ChildError(parent: EditorNode, visual: boolean, exclude?: string): string | undefined {
        const children = this.Children(parent.id).filter(child => child.id !== exclude);
        if (parent.kind === "foreach" && children.length >= 2) return "A repeated list accepts up to two item templates. Add elements inside a template.";
        const count = Core.Presets.ComponentChildren(parent.kind === "action" ? "secureButton" : parent.kind);
        if (count === "single" && visual && children.some(child => this.IsVisual(child))) return "This element accepts one child. Use a layout.";
        return undefined;
    }
    private InMemberTemplate(node: EditorNode): boolean {
        let parent = this.nodes.find(item => item.id === node.parent);
        while (parent !== undefined) {
            if (parent.kind === "blizzardElement") return true;
            if (parent.kind === "foreach") return this.sources.find(source => source.name === parent!.source)?.type === "groupMembers";
            parent = this.nodes.find(item => item.id === parent!.parent);
        }
        return false;
    }
    private ListTemplate(parent: string, id: string): EditorNode {
        return { id, parent, kind: "cell", name: "Item template", width: 180, height: 72, direction: "vertical",
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
        this.nodes = saved.nodes.map(node => node.kind === "hideActionBars" ? { ...node, kind: "hideUnitFrame", props: { ...node.props, unit: "actionBars" } } : { ...node });
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
        if (this.nodes.some(node => node.props?.classBorder !== undefined || node.props?.classBackground !== undefined)) {
            const normalized = this.Document(); this.sources = normalized.sources; this.dependencies = normalized.dependencies ?? [];
            const byId = new Map<string, PresetNode>();
            const visit = (node: PresetNode) => { byId.set(node.id, node); for (const child of node.children ?? []) visit(child); }; visit(normalized.root);
            this.nodes = this.nodes.map(node => ({ ...node, props: byId.get(node.id)?.props ?? node.props, bindings: byId.get(node.id)?.bindings ?? node.bindings }));
        }
        this.selected = this.nodes[0].id; this.ResetTree();
        this.history.Reset(this.Snapshot()); this.savedState = this.Snapshot();
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
        if (["hideUnitFrame", "hideActionBars", "blizzardElement"].includes(node.kind)) return false;
        if (node.kind === "fragment") return this.Children(node.id).some(child => this.IsVisual(child));
        if (node.kind === "preset") {
            const doc = this.dependencies.find(doc => doc.id === node.preset) ?? Core.Presets.Get(node.preset!);
            if (doc === undefined) return false;
            try { return !Core.Presets.IsHeadless({ ...doc, dependencies: this.Dependencies(doc.root) }); } catch { return false; }
        }
        return true;
    }
    public Embed(id: string): void { this.Add("preset", id); }
    public ReplacePreset(id: string): void {
        const oldInputs = this.Selected.sourceProps; this.Selected.sourceProps = undefined;
        const old = this.Selected.preset; this.Selected.preset = id;
        try { this.Document(); this.Changed("Component reference updated."); } catch (failure) { this.Selected.preset = old; this.Selected.sourceProps = oldInputs; this.Report(String(failure)); }
    }
    public Add(kind: NodeKind, preset?: string): void {
        this.propertyEditor.Flush(); this.sourceEditor.Flush();
        let parent = this.Selected;
        while (!this.CanContain(parent)) {
            const ancestor = this.nodes.find(node => node.id === parent.parent);
            if (ancestor === undefined) { this.Report("Select a container with room for another child."); return; }
            parent = ancestor;
        }
        const visual = !["hideUnitFrame", "hideActionBars", "fragment", "blizzardElement"].includes(kind) && (kind !== "preset" || !Core.Presets.IsHeadless(Core.Presets.Get(preset!)!));
        const reason = this.ChildError(parent, visual);
        if (reason !== undefined) { this.Report(reason); return; }
        const previous = this.nodes.slice(), previousSources = this.sources.slice(), previousId = this.nextId;
        const next = () => { let id = "node-" + this.nextId++; while (this.nodes.some(node => node.id === id)) id = "node-" + this.nextId++; return id; };
        const id = next();
        const unit = parent.kind === "blizzardElement" || (parent.kind === "foreach" && this.sources.find(source => source.name === parent.source)?.type === "groupMembers") || this.InMemberTemplate(parent) ? "$unit" : "player";
        const defaults = elementDefaults(kind, unit);
        const name = kind === "preset" ? "Component: " + (Core.Presets.Get(preset!)?.name ?? preset) : elementLabel(kind);
        const node: EditorNode = { id, parent: parent.id, kind, name, ...defaults, direction: "vertical", preset };
        this.nodes.push(node);
        if (kind === "blizzardElement") {
            let filter = "nameplateFilter", suffix = 1;
            while (this.sources.some(source => source.name === filter)) filter = "nameplateFilter-" + suffix++;
            this.sources.push({ name: filter, type: "unitToBool", props: {} });
            node.props!.filter = filter;
            this.nodes.push({ id: next(), parent: id, kind: "cell", name: "Nameplate template",
                ...elementDefaults("cell", "$unit"), direction: "vertical" });
        }
        if (kind === "foreach") {
            let name = "items", n = 1; while (this.sources.some(source => source.name === name)) name = "items-" + n++;
            this.sources.push({ name, type: "list", props: { items: [] } });
            node.source = name; this.nodes.push(this.ListTemplate(id, next()));
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
        if ((parent?.kind === "foreach" || parent?.kind === "blizzardElement" && parent.props?.replace === true) && this.Children(parent.id).length === 1) {
            this.Report("Keep one item template in the repeated list. Edit its contents or delete the list instead."); return;
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

    public SetBlizzardMode(replace: boolean): void {
        const node = this.Selected;
        if (node.kind !== "blizzardElement" || node.props?.replace === replace) return;
        this.propertyEditor.Ensure();
        if (!this.propertyEditor.Save()) return;
        const previous = this.nodes.slice(), props = node.props, nextId = this.nextId;
        node.props = { ...props, replace, apply: !replace };
        if (replace) {
            for (const key of ["width", "height", "scale", "alpha", "healthColor", "castColor"]) delete node.props[key];
            let id = "node-" + this.nextId++; while (this.nodes.some(item => item.id === id)) id = "node-" + this.nextId++;
            this.nodes.push({ id, parent: node.id, kind: "cell", name: "Nameplate template", ...elementDefaults("cell", "$unit"), direction: "vertical" });
        } else {
            const removed = new Set<string>();
            let changed = true;
            while (changed) { changed = false; for (const item of this.nodes) if ((item.parent === node.id || removed.has(item.parent)) && !removed.has(item.id)) { removed.add(item.id); changed = true; } }
            this.nodes = this.nodes.filter(item => !removed.has(item.id));
        }
        try { this.Document(); }
        catch (failure) { node.props = props; this.nodes = previous; this.nextId = nextId; this.Report(String(failure)); return; }
        this.propertyEditor.nodeId = "";
        this.Changed("Native element mode updated. Undo restores the previous template.");
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
    private Changed(message: string): void {
        this.Reveal(this.selected); this.history.Record(this.Snapshot());
        this.dirty = this.savedState === undefined || !sameDraft(this.Snapshot(), this.savedState);
        this.message = message; Core.RefreshCustomization();
    }

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
        this.history.Record(this.Snapshot()); this.savedState = this.Snapshot(); this.dirty = false;
        this.message = "Draft saved for this character.";
        Core.RefreshCustomization();
    }
    public New(): void {
        let index = 1;
        while (Core.Presets.Identity("Component " + index).duplicate) index++;
        const identity = Core.Presets.Identity("Component " + index); this.documentId = identity.id; this.documentName = identity.name; this.owner = undefined;
        this.activationMode = "condMet"; this.collectionClass = ""; this.collectionCondition = ""; this.nativeLayout = ""; this.layoutPositions = undefined;
        this.inspector = "properties"; this.propertyEditor.nodeId = "";
        this.nodes = [{ ...rootNode(), kind: "fragment", name: "Component", width: 0, height: 0, props: {} }]; this.sources = []; this.dependencies = []; this.nextId = 1; this.selected = "root"; this.treeScroll = 0;
        this.identityPrompt = undefined; this.ResetTree(); this.sourceEditor.Reset(); this.renaming = false; this.renameInput = undefined;
        this.history.Reset(this.Snapshot()); this.savedState = undefined;
        this.Changed("New component draft. Add elements and sources, then Save to mount it.");
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
            return { id: node.id, type: kind, props, ...(node.activation === undefined ? {} : { activation: node.activation }), ...(node.sourceProps === undefined ? {} : { sourceProps: node.sourceProps }), ...(node.bindings === undefined ? {} : { bindings: node.bindings }), ...(node.preset === undefined ? {} : { preset: node.preset }), ...(node.source === undefined ? {} : { source: node.source }),
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
            sources: this.sources, root: build(this.nodes[0]), ...(this.dependencies.length === 0 ? {} : { dependencies: this.Dependencies() }) }, true);
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
        const document = Core.Presets.Validate(input, true);
        const nodes: EditorNode[] = [];
        const visit = (node: PresetNode, parent: string) => {
            nodes.push({ id: node.id, parent, kind: node.type === "secureButton" ? "action" : node.type, name: node.type + " " + node.id,
                activation: node.activation, sourceProps: node.sourceProps, width: typeof node.props.width === "number" ? node.props.width : 140,
                height: typeof node.props.height === "number" ? node.props.height : 32,
                direction: node.props.direction === "horizontal" ? "horizontal" : "vertical", props: node.props, bindings: node.bindings, source: node.source, items: node.items, sourcePath: node.sourcePath, visibleSource: node.visibleSource, textSource: node.textSource, alphaSource: node.alphaSource, preset: node.preset });
            for (const child of node.children ?? []) visit(child, node.id);
        };
        visit(document.root, "");
        this.inspector = "properties";
        this.nodes = nodes; this.dependencies = document.dependencies ?? []; this.sources = document.sources; this.documentId = document.id; this.documentName = document.name; this.owner = document.owner;
        this.activationMode = document.enabled ?? "condMet"; this.collectionClass = document.class ?? ""; this.collectionCondition = document.condition ?? "";
        this.nativeLayout = document.layout ?? ""; this.layoutPositions = document.layoutPositions;
        this.selected = nodes[0].id; this.treeScroll = 0; this.nextId = 1; this.propertyEditor.nodeId = "";
        this.identityPrompt = undefined; this.ResetTree(); this.sourceEditor.Reset(); this.renaming = false; this.renameInput = undefined;
        this.history.Reset(this.Snapshot());
        const saved = Core.Presets.Get(document.id);
        this.savedState = saved !== undefined && equalData(Core.Presets.Validate(saved, true), document) ? this.Snapshot() : undefined;
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
        if (this.sourceEditor.HasChanges && !this.sourceEditor.SaveAll()) return;
        this.propertyEditor.Ensure();
        if (this.propertyEditor.HasChanges && !this.propertyEditor.Save()) return;
        const saved = Core.Presets.Get(this.documentId);
        if (saved !== undefined && saved.name === this.documentName) { this.Apply(); return; }
        const identity = Core.Presets.Identity(this.documentName, saved?.id);
        if (saved !== undefined || identity.duplicate) { this.identityPrompt = { ...identity, rename: saved !== undefined }; Core.RefreshCustomization(); return; }
        this.documentId = identity.id; this.documentName = identity.name; this.Apply();
    }
    public ConfirmIdentity(updateReferences: boolean): void {
        const prompt = this.identityPrompt; if (prompt === undefined) return;
        try {
            const oldID = this.documentId;
            const document = { ...this.Document(), id: prompt.id, name: prompt.name };
            if (prompt.rename) Core.Presets.Rename(document, oldID, updateReferences);
            this.documentId = prompt.id; this.documentName = prompt.name; this.identityPrompt = undefined;
            this.Apply();
        } catch (failure) { this.Report(String(failure)); }
    }
    public CancelIdentity(): void { this.identityPrompt = undefined; Core.RefreshCustomization(); }
    public Apply(): void {
        try { const document = this.Document(); Core.Presets.Apply(document); this.dependencies = []; this.Save();
            this.message = "Component saved · " + Core.Presets.ActivationStatus(this.documentId) + "."; }
        catch (failure) { this.message = String(failure); }
        Core.RefreshCustomization();
    }
    public SetReferenceActivation(key: string, value: string): void {
        const node = this.Selected; if (node.kind !== "preset") return;
        const activation = { ...node.activation } as Record<string, string>;
        if (value === "$inherit") delete activation[key]; else activation[key] = value;
        node.activation = activation as PresetNode["activation"];
        this.Changed("Component instance activation updated. Save to apply.");
    }
    public SetReferenceSource(input: string, source?: string): void {
        const node = this.Selected; if (node.kind !== "preset") return;
        node.sourceProps = { ...node.sourceProps };
        if (source === undefined || source === "") delete node.sourceProps[input]; else node.sourceProps[input] = source;
        this.Changed("Component source input updated. Save to apply.");
    }
    public Export(): void { try { Core.OpenExport(this.Document()); } catch (failure) { this.message = String(failure); Core.RefreshCustomization(); } }
    public Import(): void { Core.OpenImport("preset", document => { if (document.kind === "preset") this.Load(document); }); }

}
