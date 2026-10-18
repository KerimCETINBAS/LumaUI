import { FrameMover, KeybindCapture } from "wuira/ui";
import type { LumaCoreAPI, EditMode, LumaModule, PresetDocument, PresetInstance, PresetNode } from "../../core/contract";
import type { Presets } from "../presets/Presets";
import { positionRoot } from "../presets/LayoutPosition";

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
                if (node.type === "secureButton" && frame !== undefined && node.props.clickCastPreset === undefined && node.props.unit === undefined) bindings.push(this.capture.AddTarget(frame, key => this.SetBinding(owner, node.id, key)));
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
    public SetMode(mode: EditMode): void {
        this.mode = mode; this.capture.SetActive(mode === "keys");
        for (const id of this.active.keys()) this.RefreshMover(id);
    }
    private RefreshMover(id: string): void {
        this.movers.get(id)?.Dispose(); this.movers.delete(id);
        const active = this.active.get(id);
        if (this.mode !== "unlock" || active?.instance.Frame === undefined || InCombatLockdown()) return;
        const layoutKey = this.presets.Layouts.Status === "ready" ? this.presets.Layouts.Active?.key : undefined;
        this.movers.set(id, new FrameMover(active.instance.Frame, { label: active.document.name, onMove: position => {
            const document = this.presets.Get(id); if (document === undefined) return;
            const root = positionRoot(document.root); if (root === undefined) return;
            const key = layoutKey;
            if (key !== undefined) {
                document.layoutPositions = { ...document.layoutPositions, [key]: { x: Math.round(position.x), y: Math.round(position.y) } };
            } else {
                root.props = { ...root.props, mode: "absolute", anchor: "CENTER", relativeAnchor: "CENTER", x: Math.round(position.x), y: Math.round(position.y) };
                delete root.props.offset; delete root.props.relativeTo;
            }
            this.presets.Save(document, true);
        } }));
    }
    private SetBinding(id: string, nodeId: string, key: string | undefined): void {
        if (InCombatLockdown()) return;
        this.presets.SetBinding(id, nodeId, key);
    }
    public Reset(): void { this.SetMode("locked"); }
}
