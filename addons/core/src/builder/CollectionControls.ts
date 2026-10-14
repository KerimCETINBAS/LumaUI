import { FrameMover, KeybindCapture } from "wuira/ui";
import type { LumaCoreAPI, EditMode, LumaModule, PresetDocument, PresetInstance, PresetNode } from "../core/contract";
import type { Presets } from "./Presets";
import { BuilderSettings } from "./Library";

/** Editing targets follow mounted collection IDs; no player/hotbar-specific renderer is involved. */
export class CollectionControls implements LumaModule {
    private mode: EditMode = "locked";
    private readonly active = new Map<string, { document: PresetDocument; instance: PresetInstance }>();
    private readonly movers = new Map<string, FrameMover>();
    private readonly capture: KeybindCapture;
    public constructor(private readonly core: LumaCoreAPI, private readonly presets: Presets) {
        this.capture = new KeybindCapture(() => core.SetMode("locked"));
        presets.ObserveMount((document, instance) => {
            this.active.set(document.id, { document, instance });
            const bindings: (() => void)[] = [];
            const dependencies = new Map((document.dependencies ?? []).map(doc => [doc.id, doc]));
            this.Visit(document.root, (node, key, owner) => {
                const frame = instance.Nodes.get(key);
                if (node.type === "secureButton" && frame !== undefined) bindings.push(this.capture.AddTarget(frame, key => this.SetBinding(owner, node.id, key)));
            }, "", document.id, dependencies);
            this.RefreshMover(document.id);
            this.capture.SetActive(this.mode === "keys");
            return () => {
                for (const stop of bindings) stop();
                if (this.active.get(document.id)?.instance === instance) { this.active.delete(document.id); this.movers.get(document.id)?.Dispose(); this.movers.delete(document.id); }
            };
        });
    }
    private Visit(node: PresetNode, action: (node: PresetNode, key: string, owner: string) => void, prefix = "", owner = "", documents = new Map<string, PresetDocument>()): void {
        action(node, prefix + node.id, owner);
        for (const child of node.children ?? []) this.Visit(child, action, prefix, owner, documents);
        if (node.preset !== undefined) {
            const doc = documents.get(node.preset) ?? this.presets.Get(node.preset);
            if (doc !== undefined) this.Visit(doc.root, action, prefix + node.id + "/", doc.id, documents);
        }
    }
    private VisitOwn(node: PresetNode, action: (node: PresetNode) => void): void { action(node); for (const child of node.children ?? []) this.VisitOwn(child, action); }
    public SetMode(mode: EditMode): void {
        this.mode = mode; this.capture.SetActive(mode === "keys");
        for (const id of this.active.keys()) this.RefreshMover(id);
    }
    private RefreshMover(id: string): void {
        this.movers.get(id)?.Dispose(); this.movers.delete(id);
        const active = this.active.get(id);
        if (this.mode !== "unlock" || active?.instance.Frame === undefined || InCombatLockdown()) return;
        this.movers.set(id, new FrameMover(active.instance.Frame, { label: active.document.name, onMove: position => {
            const document = this.presets.Get(id); if (document === undefined) return;
            const positionRoot = (node: PresetNode): PresetNode | undefined => {
                if (node.type !== "fragment") return node;
                for (const child of node.children ?? []) { const candidate = positionRoot(child); if (candidate !== undefined && candidate.type !== "hideUnitFrame") return candidate; }
                return undefined;
            };
            const root = positionRoot(document.root); if (root === undefined) return;
            root.props = { ...root.props, mode: "absolute", anchor: "CENTER", relativeAnchor: "CENTER", x: Math.round(position.x), y: Math.round(position.y) };
            delete root.props.offset;
            this.presets.Save(document, true);
        } }));
    }
    private SetBinding(id: string, nodeId: string, key: string | undefined): void {
        if (InCombatLockdown()) return;
        const enabled = this.core.Store.get(BuilderSettings).enabled;
        for (const document of this.presets.List()) {
            let changed = false;
            this.VisitOwn(document.root, node => {
                if (node.type !== "secureButton") return;
                if (document.id === id && node.id === nodeId) { if (key === undefined) delete node.props.binding; else node.props.binding = key; changed = true; }
                else if (key !== undefined && node.props.binding === key) { delete node.props.binding; changed = true; }
            });
            if (!changed) continue;
            this.presets.Save(document, enabled.includes("preset:" + document.id));
            if (this.active.has(document.id)) this.presets.Mount(document);

        }
    }
    public Reset(): void { this.SetMode("locked"); }
}
