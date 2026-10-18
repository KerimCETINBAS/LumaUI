import { Encoding } from "wuira";
import { clickCastTraits } from "../clickcast/ClickCastTraits";
import type { BuilderDocument, CollectionKeybinding, LumaCoreAPI, PresetDocument, PresetNode, ClickCastPresetDocument } from "../../core/contract";
import { stripBindings } from "../presets/CollectionBindings";
import { validateAssignments } from "./BindingTransfer";
import { array, copy, fail, keys, record, text } from "../validate";

declare const GetBindingAction: ((this: void, key: string, checkOverride?: boolean) => string) | undefined;
export interface TransferPayload { document: BuilderDocument; bindings: CollectionKeybinding[]; clickCastPresets?: ClickCastPresetDocument[]; }
export interface BindingConflict { collection: string; node: string; key: string; message: string; }
export type BindingImportPolicy = "replace" | "none" | "skip";

/** Optional sharing metadata is decoded separately and committed through the binding API. */
export class PresetTransfer {
    public constructor(private readonly core: LumaCoreAPI) {}
    public Export(document: BuilderDocument, includeBindings = false, supplied: readonly ClickCastPresetDocument[] = [], includeClickCast = true): string {
        if (document.kind === "skin") return this.core.Skins.Export(document);
        const data = this.core.Presets.Validate(document, true); stripBindings(data);
        if (!includeClickCast) this.OmitClickCast({ document: data, bindings: [] });
        const ids = this.ClickCastIds(data);
        const available = new Map(ids.length === 0 ? [] : [...this.core.ClickCastPresets.List(), ...supplied].map(preset => [preset.id, preset]));
        const clickCastPresets = ids.map(id => { const preset = available.get(id); if (preset === undefined) fail("missing Click Cast preset: " + id); return this.core.ClickCastPresets.Validate(preset); });
        const bindings = includeBindings ? this.ExportBindings(data) : [];
        if (clickCastPresets.length > 0) return "!LUMA:3!" + Encoding.Encode({ version: 1, document: data, bindings, clickCastPresets });
        if (!includeBindings) return this.core.Presets.Export(data);
        return "!LUMA:2!" + Encoding.Encode({ version: 1, document: data, bindings });
    }
    /** Remove custom references with omitted metadata; standard unit actions remain available. */
    public OmitClickCast(transfer: TransferPayload): void {
        if (transfer.document.kind !== "preset") return;
        for (const document of [transfer.document, ...transfer.document.dependencies ?? []]) {
            const visit = (node: PresetNode) => {
                if (node.type === "secureButton" && typeof node.props.clickCastPreset === "string" && node.props.clickCastPreset !== "standard")
                    node.props.clickCastPreset = "standard";
                for (const child of node.children ?? []) visit(child);
            };
            visit(document.root);
        }
        transfer.clickCastPresets = undefined;
    }
    private ClickCastIds(document: PresetDocument): string[] {
        const ids = new Set<string>();
        for (const entry of [document, ...document.dependencies ?? []]) {
            const visit = (node: PresetNode) => { const id = node.props.clickCastPreset; if (node.type === "secureButton" && typeof id === "string" && id !== "standard") ids.add(id); for (const child of node.children ?? []) visit(child); };
            visit(entry.root);
        }
        return Array.from(ids);
    }
    /** Reuse equivalent mappings; conflicting IDs receive new IDs without touching existing presets. */
    public PrepareClickCast(transfer: TransferPayload): void {
        if (transfer.document.kind !== "preset" || transfer.clickCastPresets === undefined) return;
        if (InCombatLockdown()) fail("import Click Cast presets after combat");
        const equivalent = (a: ClickCastPresetDocument, b: ClickCastPresetDocument) => {
            const left = this.core.ClickCastPresets.Validate(a), right = this.core.ClickCastPresets.Validate(b);
            return left.name === right.name && left.bindings.length === right.bindings.length && left.bindings.every((binding, index) => {
                const other = right.bindings[index], first = clickCastTraits(binding.traits), second = clickCastTraits(other.traits);
                return binding.key === other.key && binding.spellId === other.spellId && binding.itemId === other.itemId
                    && binding.macro === other.macro && binding.targeting === other.targeting
                    && first.friendly === second.friendly && first.enemy === second.enemy
                    && first.nodead === second.nodead && first.clearTargeting === second.clearTargeting;
            });
        };
        const saved = this.core.ClickCastPresets.List();
        const mapping = new Map<string, string>();
        for (const preset of transfer.clickCastPresets) {
            const same = saved.find(candidate => equivalent(candidate, preset));
            const imported = same ?? this.core.ClickCastPresets.Create(preset.name, preset.bindings, preset.traits);
            mapping.set(preset.id, imported.id); if (same === undefined) saved.push(imported);
        }
        for (const entry of [transfer.document, ...transfer.document.dependencies ?? []]) {
            const visit = (node: PresetNode) => { const id = node.props.clickCastPreset; if (typeof id === "string" && mapping.has(id)) node.props.clickCastPreset = mapping.get(id)!; for (const child of node.children ?? []) visit(child); };
            visit(entry.root);
        }
    }
    private ExportBindings(document: PresetDocument): CollectionKeybinding[] {
        const records = new Map(this.core.Presets.ListBindings().map(binding => [binding.collection + "/" + binding.node, binding]));
        const bindings: CollectionKeybinding[] = [];
        for (const entry of [document, ...document.dependencies ?? []]) {
            const visit = (node: PresetNode) => {
                if (node.type === "secureButton") {
                    const binding = records.get(entry.id + "/" + node.id);
                    if (binding !== undefined) bindings.push(binding);
                }
                for (const child of node.children ?? []) visit(child);
            };
            visit(entry.root);
        }
        return validateAssignments(document, bindings);
    }
    public Decode(value: string, kind: "preset" | "skin"): TransferPayload {
        const input = text(value, "share string", 6000000).trim();
        if (kind === "skin") return { document: this.core.Skins.Import(input), bindings: [] };
        if (input.startsWith("!LUMA:2!") || input.startsWith("!LUMA:3!")) {
            const envelope = record(copy(Encoding.Decode(input.slice(8))));
            const withClickCast = input.startsWith("!LUMA:3!");
            keys(envelope, withClickCast ? ["version", "document", "bindings", "clickCastPresets"] : ["version", "document", "bindings"]);
            if (envelope.version !== 1) fail("unsupported transfer version");
            const document = this.core.Presets.Validate(envelope.document, true);
            const bindings = validateAssignments(document, envelope.bindings);
            const clickCastPresets = withClickCast ? array(envelope.clickCastPresets, 128).map(preset => this.core.ClickCastPresets.Validate(preset)) : undefined;
            if (clickCastPresets !== undefined) {
                const used = new Set(this.ClickCastIds(document)), imported = new Set<string>();
                for (const preset of clickCastPresets) { if (!used.has(preset.id) || imported.has(preset.id)) fail("invalid Click Cast dependency"); imported.add(preset.id); }
                for (const id of used) if (!imported.has(id)) fail("missing Click Cast dependency: " + id);
            }
            stripBindings(document); return { document, bindings, clickCastPresets };
        }
        const document = this.core.Presets.Import(input);
        // Old share strings may embed keys; extract them before the document reaches the editor.
        const legacy: CollectionKeybinding[] = [];
        for (const entry of [document, ...document.dependencies ?? []]) {
            const visit = (node: PresetNode) => {
                if (node.type === "secureButton" && typeof node.props.binding === "string")
                    legacy.push({ collection: entry.id, node: node.id, key: node.props.binding });
                for (const child of node.children ?? []) visit(child);
            };
            visit(entry.root);
        }
        const bindings = validateAssignments(document, legacy);
        stripBindings(document); return { document, bindings };
    }
    public Conflicts(transfer: TransferPayload): BindingConflict[] {
        if (transfer.document.kind !== "preset") return [];
        const incoming = validateAssignments(this.core.Presets.Validate(transfer.document, true), transfer.bindings);
        const current = this.core.Presets.ListBindings();
        const conflicts: BindingConflict[] = [];
        for (const binding of incoming) {
            const target = binding.collection + "/" + binding.node;
            if (current.some(existing => existing.collection === binding.collection && existing.node === binding.node && existing.key === binding.key)) continue;
            const reasons: string[] = [];
            for (const existing of current) {
                const owner = existing.collection + "/" + existing.node;
                if (existing.key === binding.key && owner !== target) reasons.push(owner);
                else if (owner === target && existing.key !== binding.key) reasons.push("currently " + existing.key);
            }
            const native = GetBindingAction?.(binding.key, false);
            if (native !== undefined && !issecretvalue(native) && native !== "") reasons.push("game binding " + native);
            if (reasons.length > 0) conflicts.push({ ...binding, message: binding.key + ": " + reasons.join(", ") + " -> " + target });
        }
        return conflicts;
    }
    /** Call only after the dialog has chosen a policy. Re-evaluate conflicts at commit time. */
    public ApplyBindings(transfer: TransferPayload, policy: BindingImportPolicy): void {
        if (InCombatLockdown()) fail("import keybindings after combat");
        if (policy === "none" || transfer.document.kind !== "preset") return;
        const document = this.core.Presets.Validate(transfer.document, true);
        const bindings = validateAssignments(document, transfer.bindings);
        const blocked = policy === "skip" ? new Set(this.Conflicts(transfer).map(binding => binding.collection + "/" + binding.node)) : new Set<string>();
        this.core.Presets.SetBindings(document, bindings.filter(binding => !blocked.has(binding.collection + "/" + binding.node)));
    }
}
