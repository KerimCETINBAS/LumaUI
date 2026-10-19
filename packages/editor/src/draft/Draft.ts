import { EditHistory, cloneData, equalData } from "./EditHistory";
import type { PresetDocument, PresetNode, SourceSpec, Properties, ActivationMode, CollectionClass, CollectionCondition } from "lumaui/core";
import { PropertyEditor } from "../property/PropertyEditor";
import { SourceEditor, BindingField } from "../property/SourceEditor";
import { Core } from "../core";
import { canOverlay, isOverlayKey, overlayChannels, overlayColors } from "../inspector/progressOverlays";
import { elementDefaults, elementLabel } from "../catalogs/ElementCatalog";
import { EditorSettings, type EditorNode, type NodeKind } from "./types";
export type { EditorNode, NodeKind } from "./types";
export { EditorSettings } from "./types";

type DraftSnapshot = Pick<EditorDraft, "nodes" | "sources" | "dependencies" | "nextId" | "documentId" | "documentName" | "owner" | "activationMode" | "collectionClass" | "collectionCondition" | "nativeLayout" | "layoutPositions" | "selected" | "sourceRenames">;
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
    public nodeRenameID?: string;
    public nodeRenameValue = "";
    private nodeRenameInput?: () => string;
    public StartNodeRename(id: string, title: string): void {
        this.propertyEditor.Flush(); this.sourceEditor.Flush(); this.selected = id;
        this.nodeRenameID = id; this.nodeRenameValue = title; Core.RefreshCustomization();
    }
    public CaptureNodeRename(read: () => string): () => void {
        this.nodeRenameInput = read; return () => { if (this.nodeRenameInput === read) { this.nodeRenameValue = read(); this.nodeRenameInput = undefined; } };
    }
    public CancelNodeRename(): void { this.nodeRenameID = undefined; this.nodeRenameInput = undefined; Core.RefreshCustomization(); }
    public FinishNodeRename(value = this.nodeRenameInput?.() ?? this.nodeRenameValue): boolean {
        const id = this.nodeRenameID; if (id === undefined) return true;
        return this.RenameNode(id,value);
    }
    public RenameNode(id: string, value: string): boolean {
        const label = value.trim(), node = this.nodes.find(item => item.id === id);
        if (node === undefined || label.length === 0 || label.length > 96) { this.Report("Use an element name between 1 and 96 characters."); return false; }
        node.label = label; this.nodeRenameID = undefined; this.nodeRenameInput = undefined;
        this.Changed("Element renamed. Save to update the component."); return true;
    }
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
    private appliedSourceRenames: EditorSettings["sourceRenames"] = [];
    public sourceRenames: { oldName: string; newName: string; updateReferences: boolean; input?: boolean }[] = [];
    public sources: SourceSpec[];
    public dependencies: PresetDocument[] = [];
    public selected = "";
    public inspector: "properties" | "sources" | "collection" = "properties";
    public readonly propertyEditor = new PropertyEditor(this);
    public readonly sourceEditor = new SourceEditor(this);
    public previewZoom: import("lumaui/core").PreviewZoom = 1;
    private readonly history = new EditHistory<DraftSnapshot>(sameDraft);
    private savedState?: DraftSnapshot;
    private Snapshot(): DraftSnapshot {
        return cloneData({ sourceRenames: this.sourceRenames, nodes: this.nodes, sources: this.sources, dependencies: this.dependencies, nextId: this.nextId,
            documentId: this.documentId, documentName: this.documentName, owner: this.owner, activationMode: this.activationMode,
            collectionClass: this.collectionClass, collectionCondition: this.collectionCondition, nativeLayout: this.nativeLayout,
            layoutPositions: this.layoutPositions, selected: this.selected });
    }
    public get HasUnsavedChanges(): boolean { return this.nodeRenameID !== undefined || this.dirty || this.propertyEditor.HasChanges || this.sourceEditor.HasChanges || this.renaming && (this.renameInput?.() ?? this.renameValue).trim() !== this.documentName; }
    private get PendingRename(): boolean { return this.renaming && (this.renameInput?.() ?? this.renameValue).trim() !== this.documentName; }
    public get CanUndo(): boolean { return this.history.CanUndo || this.propertyEditor.HasChanges || this.sourceEditor.HasChanges || this.PendingRename; }
    public get CanRedo(): boolean { return this.history.CanRedo && !this.propertyEditor.HasChanges && !this.sourceEditor.HasChanges && !this.PendingRename; }
    public Suspend(): void { if (this.nodeRenameInput !== undefined) this.nodeRenameValue = this.nodeRenameInput(); this.propertyEditor.Flush(); this.sourceEditor.Flush(); if (this.renaming && this.renameInput !== undefined) this.renameValue = this.renameInput(); }
    private StageEdits(): boolean {
        if (this.renaming && !this.Rename()) return false;
        if (this.sourceEditor.HasChanges && !this.sourceEditor.SaveAll()) return false;
        this.propertyEditor.Ensure();
        return !this.propertyEditor.HasChanges || this.propertyEditor.Save();
    }
    private RestoreSnapshot(snapshot: DraftSnapshot): void {
        const source = this.sourceEditor.original;
        Object.assign(this, cloneData(snapshot));
        this.nodeRenameID = undefined; this.nodeRenameInput = undefined; this.renaming = false; this.renameInput = undefined; this.propertyEditor.Open(); this.sourceEditor.Reset();
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
        if (tab === "sources" && !this.sourceEditor.HasChanges) this.sourceEditor.Open(this.Selected?.source ?? this.sources[0]?.name);
        else Core.RefreshCustomization();
    }
    public UpdateProperties(props: Properties, bindingPath?: string, items?: string, bindings?: PresetNode["bindings"], visibility?: { path: string; when: "true" | "false" }, glow?: { path: string; when: "true" | "false" }): void {
        const node = this.Selected; const oldProps = node.props, oldPath = node.sourcePath, oldSource = node.source, oldItems = node.items, oldBindings = node.bindings, oldVisiblePath = node.visiblePath, oldVisibleWhen = node.visibleWhen, oldGlowPath = node.glowPath, oldGlowWhen = node.glowWhen; node.props = props;
        if (bindings !== undefined) node.bindings = Object.keys(bindings).length === 0 ? undefined : bindings;
        if (bindingPath !== undefined && (node.source !== undefined || node.textSource !== undefined)) { if (bindingPath.trim() === "") delete node.sourcePath; else node.sourcePath = bindingPath.trim(); }
        if (visibility !== undefined && node.visibleSource !== undefined) {
            if (visibility.path.trim() === "") delete node.visiblePath; else node.visiblePath = visibility.path.trim();
            if (visibility.when === "false") node.visibleWhen = "false"; else delete node.visibleWhen;
        }
        if (glow !== undefined && node.glowSource !== undefined) {
            if (glow.path.trim() === "") delete node.glowPath; else node.glowPath = glow.path.trim();
            if (glow.when === "false") node.glowWhen = "false"; else delete node.glowWhen;
        }
        if (items !== undefined && node.kind === "foreach") { node.items = items.trim(); delete node.source; delete node.sourcePath; }
        try { const preview = Core.Presets.Preview(this.Document()); preview.Dispose(); }
        catch (failure) { node.props = oldProps; node.sourcePath = oldPath; node.source = oldSource; node.items = oldItems; node.bindings = oldBindings; if (oldVisiblePath === undefined) delete node.visiblePath; else node.visiblePath = oldVisiblePath; if (oldVisibleWhen === undefined) delete node.visibleWhen; else node.visibleWhen = oldVisibleWhen; if (oldGlowPath === undefined) delete node.glowPath; else node.glowPath = oldGlowPath; if (oldGlowWhen === undefined) delete node.glowWhen; else node.glowWhen = oldGlowWhen; throw failure; }
        if (typeof props.width === "number") node.width = props.width;
        if (typeof props.height === "number") node.height = props.height;
        if (props.direction === "horizontal" || props.direction === "vertical") node.direction = props.direction;
        this.Changed("Properties updated. Save to update the mounted component.");
    }
    public Report(message: string): void { this.message = message; Core.RefreshCustomization(); }
    public UpdateSources(sources: SourceSpec[]): void {
        const document = Core.Presets.Validate({ ...this.Document(), sources }, true);
        const preview = Core.Presets.Preview(document); preview.Dispose();
        this.sources = document.sources; this.Changed("Sources updated. Save to update the mounted component.");
    }
    public RenameSource(oldName: string, newName: string, updateReferences: boolean, edited?: SourceSpec): void {
        const inputDocument = this.Document();
        if (edited !== undefined) inputDocument.sources = inputDocument.sources.map(source => source.name === oldName ? edited : source);
        const document = Core.Presets.RenameSource(inputDocument, oldName, newName.trim(), updateReferences);
        const nodes = new Map<string, PresetNode>();
        const visit = (node: PresetNode): void => { nodes.set(node.id, node); for (const child of node.children ?? []) visit(child); }; visit(document.root);
        this.nodes = this.nodes.map(node => { const updated = nodes.get(node.id)!; return { ...node, props: updated.props, source: updated.source, visibleSource: updated.visibleSource, glowSource: updated.glowSource, textSource: updated.textSource, alphaSource: updated.alphaSource, bindings: updated.bindings, sourceProps: updated.sourceProps, sections: updated.sections === undefined ? undefined : [...updated.sections] }; });
        const input = this.sources.find(source => source.name === oldName)?.isProp === true;
        this.sources = document.sources;
        if (updateReferences) { this.sourceEditor.RewriteReferences(oldName, newName.trim()); this.propertyEditor.RewriteReferences(oldName, newName.trim()); }
        this.sourceRenames = [...this.sourceRenames, { oldName, newName: newName.trim(), updateReferences, input }];
        this.Changed(updateReferences ? "Source renamed; references updated. Save applies input changes to callers." : "Source renamed; old references remain missing. Repair them in Data.");
    }
    public ReferenceItemAvailable(): boolean {
        return this.ReferenceContextCompatible("parent.$item", "repeatItem");
    }
    public ReferenceContextCompatible(reference: string, expected: string): boolean {
        const parent = this.nodes.find(node => node.id === this.Selected?.parent);
        if (parent?.kind !== "foreach") return false;
        const owner = parent.label ?? (parent === this.nodes[0] ? this.documentName : parent.name);
        const field = (["$item", "$unit", "$pet"] as const).find(field => reference === "parent." + field || reference === owner + "." + field);
        if (field === undefined) return false;
        const type = parent.items === undefined ? this.sources.find(source => source.name === parent.source)?.type : Core.Presets.ParseItems(parent.items).type;
        return Core.Presets.RepeatSourceCompatible(type, field, expected);
    }
    public ReferenceSourceError(input: string, reference?: string): string | undefined {
        const node = this.Selected;
        const document = this.dependencies.find(doc => doc.id === node.preset) ?? Core.Presets.Get(node.preset!);
        const target = document?.sources.find(spec => spec.isProp && spec.name === input);
        if (target === undefined) return "Unknown component input: " + input;
        if (reference === undefined || reference.trim() === "") return target.optional ? undefined : "Required input is not connected";
        if ([".$item", ".$unit", ".$pet"].some(field => reference.endsWith(field))) {
            const parent = this.nodes.find(item => item.id === node.parent);
            if (parent?.kind !== "foreach") return "Reference '" + reference + "' needs a Repeat parent. This component is outside Repeat.";
            const owner = parent.label ?? (parent === this.nodes[0] ? this.documentName : parent.name);
            const field = (["$item", "$unit", "$pet"] as const).find(field => reference.endsWith("." + field))!;
            if (reference !== "parent." + field && reference !== owner + "." + field) return "Reference '" + reference + "' does not name this component's Repeat ('" + owner + "'). Use parent." + field + ".";
            let collection: string | undefined;
            try { collection = parent.items === undefined ? this.sources.find(source => source.name === parent.source)?.type : Core.Presets.ParseItems(parent.items).type; }
            catch { return "Fix the list helper on Repeat '" + owner + "' before connecting this input."; }
            if (Core.Presets.RepeatSourceCompatible(collection, field, target.type)) return undefined;
            const expected = target.type === "class" ? "Unit class" : target.type === "unit" ? "UnitSource" : target.type === "repeatItem" ? "Repeat item" : target.type;
            if (target.type === "class") return "Input '" + input + "' expects Unit class; '" + reference + "' is a Repeat context. Expose a UnitSource input and derive Unit class inside the child, or connect an existing Unit class source. The previous connection is unchanged.";
            if (collection === undefined) return "Choose a list on Repeat '" + owner + "' before connecting input '" + input + "' (" + expected + ").";
            return "Input '" + input + "' expects " + expected + ". Repeat '" + owner + "' (" + collection + ") cannot provide that type through " + field + ". The previous connection is unchanged.";
        }
        const supplied = this.sources.find(source => source.name === reference);
        if (supplied === undefined) return "Missing source: " + reference;
        return Core.Presets.SourcesCompatible(supplied.type, target.type) ? undefined : "Incompatible source type: " + supplied.type;
    }
    public OpenReference(): void {
        if (this.HasUnsavedChanges) { this.Report("Save this parent component before opening its child definition; your parent edits are still in this draft."); return; }
        const node = this.Selected;
        const document = this.dependencies.find(doc => doc.id === node.preset) ?? Core.Presets.Get(node.preset!);
        if (document !== undefined) this.Load({ ...document, dependencies: this.Dependencies(document.root) });
    }
    public ReferenceUnitAvailable(): boolean {
        const parent = this.nodes.find(node => node.id === this.Selected.parent);
        if (parent?.kind !== "foreach") return false;
        let type: string | undefined;
        try { type = parent.items === undefined ? this.sources.find(source => source.name === parent.source)?.type : Core.Presets.ParseItems(parent.items).type; }
        catch { return false; }
        return Core.Presets.RepeatSourceCompatible(type, "$unit", "unit");
    }
    public UseMemberUnit(token: "$unit" | "$pet"): void {
        this.sourceEditor.Flush();
        const current = this.sourceEditor.original;
        const sources = this.sources.map(source => {
            if (source.isProp) {
                if (source.type !== "unit" && source.type !== "repeatItem" && source.optional !== true) return { ...source, optional: true };
                return source;
            }
            if (typeof source.props.unit !== "string") return source;
            return { ...source, props: { ...source.props, unit: token } };
        });
        try { this.UpdateSources(sources); this.sourceEditor.Open(current); }
        catch (failure) { this.Report(String(failure)); }
    }
    public UseRowUnit(token: "" | "$unit" | "$pet"): void {
        const node = this.Selected;
        if (node.kind !== "preset" || node.preset === undefined) return;
        this.propertyEditor.Flush(); this.sourceEditor.Flush();
        const existing = this.dependencies.find(doc => doc.id === node.preset) ?? Core.Presets.Get(node.preset);
        if (existing === undefined) { this.Report("Missing component."); return; }
        const previousProps = node.sourceProps === undefined ? undefined : { ...node.sourceProps };
        const previousDeps = this.dependencies.slice();
        const binding = token === "$unit" ? "parent.$unit" : token === "$pet" ? "parent.$pet" : "";
        const sources = existing.sources.map(source => {
            if (source.isProp) {
                if (token !== "" && source.type !== "unit" && source.type !== "repeatItem" && source.optional !== true) return { ...source, optional: true };
                return source;
            }
            if (typeof source.props.unit !== "string") return source;
            if (token === "") {
                if (source.props.unit !== "$unit" && source.props.unit !== "$pet") return source;
                return { ...source, props: { ...source.props, unit: "player" } };
            }
            return { ...source, props: { ...source.props, unit: token } };
        });
        const child = { ...existing, sources };
        const bound = { ...(node.sourceProps ?? {}) };
        for (const input of existing.sources) {
            if (!input.isProp || input.type !== "unit") continue;
            if (binding === "") delete bound[input.name]; else bound[input.name] = binding;
        }
        if (Object.keys(bound).length === 0) delete node.sourceProps; else node.sourceProps = bound;
        const index = this.dependencies.findIndex(doc => doc.id === child.id);
        if (index >= 0) this.dependencies[index] = child; else this.dependencies.push(child);
        try { const preview = Core.Presets.Preview(this.Document()); preview.Dispose(); }
        catch (failure) {
            if (previousProps === undefined) delete node.sourceProps; else node.sourceProps = previousProps;
            this.dependencies = previousDeps;
            this.Report(String(failure));
            return;
        }
        this.Changed(token === "" ? "Row unit cleared. Save to apply." : "This component uses the current member. Save to apply.");
    }
    public BindSource(name: string | undefined, field: BindingField, path?: string, when?: "true" | "false"): void {
        const node = this.Selected; const previousItems = node.items; const previous = node[field]; const oldProps = node.props; const previousPath = node.sourcePath; const previousVisiblePath = node.visiblePath; const previousVisibleWhen = node.visibleWhen; const previousGlowPath = node.glowPath; const previousGlowWhen = node.glowWhen; const previousNodes = this.nodes; const previousId = this.nextId;
        if (name === undefined) delete node[field]; else { node[field] = name; if (field === "source" && node.kind === "foreach") delete node.items; }
        if (field === "source" || field === "textSource") { if (name === undefined || path === undefined || path.trim() === "") delete node.sourcePath; else node.sourcePath = path.trim(); }
        if (field === "visibleSource") {
            if (name === undefined || path === undefined || path.trim() === "") delete node.visiblePath; else node.visiblePath = path.trim();
            if (name !== undefined && when === "false") node.visibleWhen = "false"; else delete node.visibleWhen;
        }
        if (field === "glowSource") {
            if (name === undefined || path === undefined || path.trim() === "") delete node.glowPath; else node.glowPath = path.trim();
            if (name !== undefined && when === "false") node.glowWhen = "false"; else delete node.glowWhen;
        }
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
        catch (failure) { this.nodes = previousNodes; this.nextId = previousId; if (previousItems === undefined) delete node.items; else node.items = previousItems; if (previous === undefined) delete node[field]; else node[field] = previous; node.props = oldProps; if (previousPath === undefined) delete node.sourcePath; else node.sourcePath = previousPath; if (previousVisiblePath === undefined) delete node.visiblePath; else node.visiblePath = previousVisiblePath; if (previousVisibleWhen === undefined) delete node.visibleWhen; else node.visibleWhen = previousVisibleWhen; if (previousGlowPath === undefined) delete node.glowPath; else node.glowPath = previousGlowPath; if (previousGlowWhen === undefined) delete node.glowWhen; else node.glowWhen = previousGlowWhen; this.Report(String(failure)); return; }
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
        if (parent.kind === "foreach" && source.kind !== "preset") return "Repeat requires a component reference.";
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
        if (this.nodes.length === 0) return;
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
        this.dependencies = saved.dependencies ?? []; this.sourceRenames = saved.sourceRenames ?? []; this.appliedSourceRenames = saved.appliedSourceRenames ?? [];
        this.sources = saved.sources.map(source => ({ ...source, props: { ...source.props } }));
        if (this.nodes.some(node => node.props?.classBorder !== undefined || node.props?.classBackground !== undefined)) {
            const normalized = this.Document(); this.sources = normalized.sources; this.dependencies = normalized.dependencies ?? [];
            const byId = new Map<string, PresetNode>();
            const visit = (node: PresetNode) => { byId.set(node.id, node); for (const child of node.children ?? []) visit(child); }; visit(normalized.root);
            this.nodes = this.nodes.map(node => ({ ...node, props: byId.get(node.id)?.props ?? node.props, bindings: byId.get(node.id)?.bindings ?? node.bindings }));
        }
        if (this.nodes.some(node => node.kind === "foreach")) this.Load(this.Document());
        this.selected = this.nodes[0]?.id ?? ""; this.ResetTree();
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
        if (this.nodes.length > 0) visit(this.nodes[0], 0);
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
        if (!expand) { for (const node of this.nodes) if (node !== this.nodes[0] && this.Children(node.id).length > 0) this.collapsed.add(node.id); if (this.nodes.length > 0) this.Select(this.nodes[0].id); this.treeScroll = 0; }
        Core.RefreshCustomization();
    }
    public Select(id: string): void {
        if (this.selected === id || !this.nodes.some(node => node.id === id)) return;
        if (this.propertyEditor.HasChanges && !this.propertyEditor.Save()) {
            // A rejected connection restores only that field. It must not trap navigation.
            if (!this.propertyEditor.RejectedConnection || this.propertyEditor.HasChanges && !this.propertyEditor.Save()) return;
        }
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
        while (parent !== undefined && !this.CanContain(parent)) {
            const ancestor = this.nodes.find(node => node.id === parent.parent);
            if (ancestor === undefined) { this.Report("Select a container with room for another child."); return; }
            parent = ancestor;
        }
        const visual = !["hideUnitFrame", "hideActionBars", "fragment", "blizzardElement"].includes(kind) && (kind !== "preset" || !Core.Presets.IsHeadless(Core.Presets.Get(preset!)!));
        const reason = parent === undefined ? undefined : this.ChildError(parent, visual);
        if (parent?.kind === "foreach" && kind !== "preset") { this.Report("Repeat requires a component reference. Edit its component separately."); return; }
        if (reason !== undefined) { this.Report(reason); return; }
        const previous = this.nodes.slice(), previousSources = this.sources.slice(), previousDependencies = this.dependencies.slice(), previousId = this.nextId;
        const next = () => { let id = "node-" + this.nextId++; while (this.nodes.some(node => node.id === id)) id = "node-" + this.nextId++; return id; };
        const id = this.nodes.length === 0 ? "root" : next();
        const memberDocument = this.sources.some(source => source.type === "repeatItem");
        const unit = memberDocument || parent !== undefined && (parent.kind === "blizzardElement" || (parent.kind === "foreach" && this.sources.find(source => source.name === parent.source)?.type === "groupMembers") || this.InMemberTemplate(parent)) ? "$unit" : "player";
        const defaults = elementDefaults(kind, unit);
        const name = kind === "preset" ? "Component: " + (Core.Presets.Get(preset!)?.name ?? preset) : elementLabel(kind);
        const node: EditorNode = { id, parent: parent?.id ?? "", kind, name, ...(kind === "foreach" && parent !== undefined ? { label: name } : {}), ...defaults, direction: "vertical", preset };
        this.nodes.push(node);
        if (kind === "preset" && parent?.kind === "foreach" && this.sources.find(source => source.name === parent.source)?.type === "groupMembers") {
            const referenced = this.dependencies.find(doc => doc.id === preset) ?? Core.Presets.Get(preset!);
            const bound = { ...node.sourceProps };
            for (const input of referenced?.sources ?? []) if (input.isProp && input.optional !== true && input.type === "unit" && bound[input.name] === undefined) bound[input.name] = "parent.$unit";
            if (Object.keys(bound).length > 0) node.sourceProps = bound;
        }
        if (kind === "blizzardElement") {
            let filter = "nameplateFilter", suffix = 1;
            while (this.sources.some(source => source.name === filter)) filter = "nameplateFilter-" + suffix++;
            this.sources.push({ name: filter, type: "unitToBool", props: {} });
            node.props!.filter = filter;
            this.nodes.push({ id: next(), parent: id, kind: "cell", name: "Nameplate template",
                ...elementDefaults("cell", "$unit"), direction: "vertical" });
        }
        if (kind === "foreach") {
            const baseID = (this.documentId + "-" + id + "-item").slice(0, 85);
            let childID = baseID, suffix = 1;
            while (this.dependencies.some(doc => doc.id === childID) || Core.Presets.Get(childID) !== undefined) childID = baseID + "-" + suffix++;
            const group = this.sources.find(source => source.name === node.source)?.type === "groupMembers";
            this.dependencies.push({ version: 1, kind: "preset", id: childID, name: this.documentName + " / Item", sources: [{ name: "Item", type: "repeatItem", props: {}, isProp: true }, ...(group ? [{ name: "Unit", type: "unit", props: {}, isProp: true }] : [])], root: { id: "root", type: "cell", props: { width: 180, height: 72 } } });
            this.nodes.push({ id: next(), parent: id, kind: "preset", preset: childID, sourceProps: { Item: "parent.$item", ...(group ? { Unit: "parent.$unit" } : {}) }, name: "Item component", width: 180, height: 72, direction: "vertical", props: {} });
        }
        try { this.Document(); }
        catch (failure) { this.nodes = previous; this.sources = previousSources; this.dependencies = previousDependencies; this.nextId = previousId; this.Report(String(failure)); return; }
        this.selected = id; this.propertyEditor.nodeId = "";
        this.treeScroll = Math.max(0, this.Tree().findIndex(item => item.node.id === id) * 32 - 128);
        this.Changed("Element added.");
    }

    public SetRootKind(kind: string): void {
        if (!["cell", "flow", "grid", "fragment"].includes(kind)) return;
        if (this.nodes.length === 0) { this.Add(kind); return; }
        this.propertyEditor.Flush(); this.sourceEditor.Flush();
        const previous = this.nodes, node = this.nodes[0];
        const rules = kind === "fragment" ? {} : Core.Presets.ComponentProperties(kind);
        const defaults = elementDefaults(kind, "player"), props: Properties = {};
        for (const [key,value] of Object.entries(node.props ?? {})) if (rules[key] !== undefined) props[key] = value;
        const width = node.width > 0 ? node.width : 320, height = node.height > 0 ? node.height : 180;
        if (kind !== "fragment") Object.assign(props, { ...defaults.props, ...props }, {width,height});
        this.nodes = [{ ...node, kind, name: elementLabel(kind), props, width: kind === "fragment" ? 0 : width, height: kind === "fragment" ? 0 : height,
            source: undefined, sourcePath: undefined, visibleSource: undefined, visiblePath: undefined, visibleWhen: undefined, glowSource: undefined, glowPath: undefined, glowWhen: undefined, textSource: undefined, alphaSource: undefined, bindings: undefined, preset: undefined, sourceProps: undefined, activation: undefined, items: undefined }, ...this.nodes.slice(1)];
        try { this.Document(); } catch (failure) { this.nodes = previous; this.Report(String(failure)); return; }
        this.selected = node.id; this.propertyEditor.nodeId = ""; this.Changed("Root element updated. Headless groups are optional.");
    }
    public Remove(): void {
        const node = this.Selected; if (node === undefined) return;
        if (node === this.nodes[0]) {
            if (node.kind !== "fragment" || this.Children(node.id).length === 0) {
                this.nodes = []; this.selected = ""; this.nodeRenameID = undefined; this.nodeRenameInput = undefined;
                this.propertyEditor.Open(); this.ResetTree(); this.Changed("Root removed. Add an element to start again."); return;
            }
            const children = this.Children(node.id);
            if (children.length !== 1) { this.SetRootKind(children.length === 0 ? "cell" : "flow"); return; }
            const previous = this.nodes, child = children[0];
            const candidate = cloneData(this.nodes.filter(item => item.id !== node.id));
            const promoted = candidate.find(item => item.id === child.id)!; promoted.parent = "";
            for (const item of candidate) if (item.props?.relativeTo === node.id) { if (item.id === promoted.id) delete item.props.relativeTo; else item.props.relativeTo = promoted.id; }
            this.nodes = [promoted, ...candidate.filter(item => item.id !== promoted.id)];
            try { this.Document(); } catch (failure) { this.nodes = previous; this.Report(String(failure)); return; }
            this.selected = promoted.id; this.propertyEditor.nodeId = ""; this.Changed("Headless group removed; its content is preserved."); return;
        }
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
            settings.dependencies = this.dependencies; settings.sourceRenames = this.sourceRenames; settings.appliedSourceRenames = this.appliedSourceRenames;
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
        this.nodes = []; this.sources = []; this.dependencies = []; this.sourceRenames = []; this.appliedSourceRenames = []; this.nextId = 1; this.selected = ""; this.treeScroll = 0;
        this.nodeRenameID = undefined; this.nodeRenameInput = undefined; this.identityPrompt = undefined; this.ResetTree(); this.sourceEditor.Reset(); this.renaming = false; this.renameInput = undefined;
        this.history.Reset(this.Snapshot()); this.savedState = undefined;
        this.Changed("New component draft. Add elements and sources, then Save to mount it.");
    }
    public Document(): PresetDocument {
        // Empty drafts use a validation envelope only; it is never a hierarchy node or a preview,
        // and Commit/Apply require a user-created root before saving a component.
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
            return { id: node.id, type: kind, props, ...(node.label === undefined ? {} : { name: node.label }), ...(node.activation === undefined ? {} : { activation: node.activation }), ...(node.sourceProps === undefined ? {} : { sourceProps: node.sourceProps }), ...(node.bindings === undefined ? {} : { bindings: node.bindings }), ...(node.preset === undefined ? {} : { preset: node.preset }), ...(node.source === undefined ? {} : { source: node.source }),
                ...(node.items === undefined ? {} : { items: node.items }),
                ...(node.sourcePath === undefined ? {} : { sourcePath: node.sourcePath }),
                ...(node.visibleSource === undefined ? {} : { visibleSource: node.visibleSource }),
                ...(node.visiblePath === undefined ? {} : { visiblePath: node.visiblePath }),
                ...(node.visibleWhen === undefined ? {} : { visibleWhen: node.visibleWhen }),
                ...(node.glowSource === undefined ? {} : { glowSource: node.glowSource }),
                ...(node.glowPath === undefined ? {} : { glowPath: node.glowPath }),
                ...(node.glowWhen === undefined ? {} : { glowWhen: node.glowWhen }),
                ...(node.textSource === undefined ? {} : { textSource: node.textSource }),
                ...(node.alphaSource === undefined ? {} : { alphaSource: node.alphaSource }),
                ...(node.sections === undefined || node.sections.length === 0 ? {} : { sections: node.sections }),
                children: this.Children(node.id).map(build) };
        };
        return Core.Presets.Validate({ version: 1, kind: "preset", id: this.documentId, name: this.documentName,
            enabled: this.activationMode, ...(this.collectionClass === "" ? {} : { class: this.collectionClass }),
            ...(this.collectionCondition === "" ? {} : { condition: this.collectionCondition }), ...(this.owner === undefined ? {} : { owner: this.owner }),
            ...(this.nativeLayout === "" ? {} : { layout: this.nativeLayout }), ...(this.layoutPositions === undefined ? {} : { layoutPositions: this.layoutPositions }),
            sources: this.sources, root: this.nodes.length === 0 ? { id: "empty-draft", type: "fragment", props: {} } : build(this.nodes[0]), ...(this.dependencies.length === 0 ? {} : { dependencies: this.Dependencies() }) }, true);
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
            nodes.push({ id: node.id, parent, label: node.name, kind: node.type === "secureButton" ? "action" : node.type, name: node.type + " " + node.id,
                activation: node.activation, sourceProps: node.sourceProps, width: typeof node.props.width === "number" ? node.props.width : 140,
                height: typeof node.props.height === "number" ? node.props.height : 32,
                direction: node.props.direction === "horizontal" ? "horizontal" : "vertical", props: node.props, bindings: node.bindings, source: node.source, items: node.items, sourcePath: node.sourcePath, visibleSource: node.visibleSource, visiblePath: node.visiblePath, visibleWhen: node.visibleWhen, glowSource: node.glowSource, glowPath: node.glowPath, glowWhen: node.glowWhen, textSource: node.textSource, alphaSource: node.alphaSource, preset: node.preset, sections: node.sections === undefined ? undefined : [...node.sections] });
            for (const child of node.children ?? []) visit(child, node.id);
        };
        visit(document.root, "");
        this.inspector = "properties";
        this.sourceRenames = []; this.appliedSourceRenames = []; this.nodes = nodes; this.dependencies = document.dependencies ?? []; this.sources = document.sources; this.documentId = document.id; this.documentName = document.name; this.owner = document.owner;
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
        if (this.nodes.length === 0) { this.Report("Add an element before saving the component."); return; }
        if (!this.FinishNodeRename()) return;
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
        if (this.nodes.length === 0) { this.Report("Add an element before saving the component."); return; }
        try {
            const document = this.Document();
            let common = 0;
            while (common < this.sourceRenames.length && common < this.appliedSourceRenames.length && equalData(this.sourceRenames[common], this.appliedSourceRenames[common])) common++;
            const changes = this.appliedSourceRenames.slice(common).reverse().map(rename => ({ ...rename, oldName: rename.newName, newName: rename.oldName }));
            changes.push(...this.sourceRenames.slice(common));
            if (changes.length > 0) Core.Presets.ApplySourceRenames(document, changes); else Core.Presets.Apply(document);
            this.appliedSourceRenames = cloneData(this.sourceRenames); this.dependencies = []; this.Save();
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
    public sectionSource = "";
    public sectionKey = "";
    public SetContentKey(key: string): void {
        const node = this.Selected; if (node.props === undefined) node.props = {};
        if (node.kind === "unitText" || node.kind === "unitIndicator") node.props.field = key;
        if (node.kind === "unitAuras" || node.kind === "unitAuraIndicator") node.props.category = key;
        this.Changed("Section updated.");
    }
    public AddSection(): void {
        const node = this.Selected;
        if (this.sectionSource === "" || this.sectionKey === "") { this.Report("Choose a source and a key."); return; }
        const sections = [...(node.sections ?? [])];
        if (!sections.some(section => section.source === this.sectionSource && section.key === this.sectionKey)) sections.push({ source: this.sectionSource, key: this.sectionKey });
        node.sections = sections;
        this.Changed("Section added. It reads that source key.");
    }
    public RemoveSection(index: number): void {
        const node = this.Selected;
        const sections = (node.sections ?? []).filter((_, item) => item !== index);
        if (sections.length === 0) delete node.sections; else node.sections = sections;
        this.Changed("Section removed.");
    }
    private PreviewSections(previous: EditorNode["sections"], message: string): boolean {
        try { const preview = Core.Presets.Preview(this.Document()); preview.Dispose(); }
        catch (failure) { if (previous === undefined) delete this.Selected.sections; else this.Selected.sections = previous; this.Report(String(failure)); return false; }
        this.Changed(message); return true;
    }
    public AddOverlay(): void {
        const node = this.Selected;
        if (node.kind !== "progress") return;
        const sources = this.sources.filter(source => canOverlay(source.type));
        if (sources.length === 0) { this.Report("Add a progress source first."); return; }
        this.propertyEditor.CommitOverlays();
        const previous = node.sections === undefined ? undefined : [...node.sections];
        const sections = [...(node.sections ?? [])];
        const health = sources.find(source => source.type === "hp" && source.name === node.source) ?? sources.find(source => source.type === "hp");
        let source = node.source !== undefined && sources.some(item => item.name === node.source) ? node.source : sources[0].name;
        let key = "progress";
        if (health !== undefined && !sections.some(section => section.source === health.name && section.key === "absorb")) { source = health.name; key = "absorb"; }
        sections.push({ source, key, color: overlayColors[key] ?? overlayColors.progress });
        node.sections = sections;
        if (!this.PreviewSections(previous, "Overlay added. It draws inside this bar.")) return;
        this.propertyEditor.SyncOverlays(); Core.RefreshCustomization();
    }
    public SetOverlay(index: number, patch: { source?: string; key?: string }): void {
        const node = this.Selected;
        const previous = node.sections === undefined ? undefined : [...node.sections];
        const sections = [...(node.sections ?? [])];
        const current = sections[index];
        if (current === undefined || !isOverlayKey(current.key)) return;
        const source = patch.source ?? current.source;
        const key = patch.key ?? (patch.source !== undefined && patch.source !== current.source ? overlayChannels(this.sources.find(item => item.name === source)?.type ?? "")[0]?.value ?? "progress" : current.key);
        sections[index] = { ...current, source, key, color: current.color ?? overlayColors[key] ?? overlayColors.progress };
        node.sections = sections;
        this.PreviewSections(previous, "Overlay updated.");
    }
    public RemoveOverlay(index: number): void {
        const node = this.Selected;
        this.propertyEditor.CommitOverlays();
        const previous = node.sections === undefined ? undefined : [...node.sections];
        const sections = (node.sections ?? []).filter((_, item) => item !== index);
        if (sections.length === 0) delete node.sections; else node.sections = sections;
        if (!this.PreviewSections(previous, "Overlay removed.")) return;
        this.propertyEditor.SyncOverlays(); Core.RefreshCustomization();
    }
    public SetReferenceSource(input: string, source?: string): void {
        const node = this.Selected; if (node.kind !== "preset") return;
        const previous = node.sourceProps;
        node.sourceProps = { ...node.sourceProps };
        if (source === undefined || source === "") delete node.sourceProps[input]; else node.sourceProps[input] = source;
        try {
            if (source !== undefined && source !== "") {
                const error = this.ReferenceSourceError(input, source); if (error !== undefined) throw error;
            }
            this.Document();
        }
        catch (failure) { node.sourceProps = previous; this.Report(String(failure)); return; }
        this.Changed("Component source input updated. Save to apply.");
    }
    public Export(): void { try { Core.OpenExport(this.Document()); } catch (failure) { this.message = String(failure); Core.RefreshCustomization(); } }
    public Import(): void { Core.OpenImport("preset", document => { if (document.kind === "preset") this.Load(document); }); }

}
