import { UI, wuira } from "wuira";
import { Window, TextInput, ScrollHost, FlowLayout, Cell, Label, Button, Background, Border } from "wuira/ui";
import type { LumaCoreAPI, BuilderDocument, ClickCastPresetDocument } from "../core/contract";
import { PresetTransfer } from "./PresetTransfer";
import type { TransferPayload, BindingConflict, BindingImportPolicy } from "./PresetTransfer";

/** Copy/paste transport and optional keybinding metadata belong to the master. */
export class TransferDialog {
    private readonly window = new Window({ width: 680, height: 400 });
    private readonly transfer: PresetTransfer;
    private input?: TextInput;
    private text = "";
    private message = "";
    private kind: "preset" | "skin" = "preset";
    private exporting = false;
    private includeBindings = false;
    private exportDocument?: BuilderDocument;
    private exportClickCast: readonly ClickCastPresetDocument[] = [];
    private pending?: TransferPayload;
    private conflicts: BindingConflict[] = [];
    private imported?: (document: BuilderDocument) => void;
    public constructor(private readonly core: LumaCoreAPI) { this.transfer = new PresetTransfer(core); }
    public Import(kind: "preset" | "skin", callback?: (document: BuilderDocument) => void, importString?: string): void {
        if (InCombatLockdown()) { console.log("LumaUI: import after combat."); return; }
        this.kind = kind; this.imported = callback; this.exporting = false; this.text = importString ?? "";
        this.includeBindings = false; this.exportDocument = undefined; this.pending = undefined; this.conflicts = [];
        this.message = importString === undefined
            ? "Paste a LumaUI " + (kind === "preset" ? "component" : "skin") + " string. Imported documents start disabled."
            : "Built-in preset ready. Confirm Import to save it disabled. Existing components are kept.";
        this.Open();
    }
    public Export(document: BuilderDocument, clickCastPresets: readonly ClickCastPresetDocument[] = []): void {
        if (InCombatLockdown()) return;
        this.kind = document.kind; this.imported = undefined; this.exporting = true;
        this.includeBindings = false; this.exportDocument = document; this.pending = undefined; this.conflicts = [];
        this.exportClickCast = clickCastPresets;
        this.text = this.transfer.Export(document, false, clickCastPresets);
        this.message = "Choose whether to include character keybindings, then press Ctrl+C to copy.";
        this.Open();
    }
    private ToggleBindings(): void {
        if (InCombatLockdown()) return;
        if (!this.exporting) this.text = this.input?.Value ?? this.text;
        this.includeBindings = !this.includeBindings;
        try {
            if (this.exportDocument !== undefined) this.text = this.transfer.Export(this.exportDocument, this.includeBindings, this.exportClickCast);
            this.message = this.exporting ? "Press Ctrl+C to copy the selected string."
                : this.includeBindings && this.imported !== undefined
                    ? "Selected keys are saved when imported. The editor layout stays a draft until Apply."
                    : this.includeBindings ? "Keybindings are optional. Conflicts require a choice before import."
                    : "Only the component will be imported; current keybindings stay unchanged.";
        } catch (failure) { this.message = String(failure); }
        this.Open();
    }
    private CheckDestination(document: BuilderDocument): void {
        if (this.imported !== undefined) return;
        const existing = document.kind === "preset" ? this.core.Presets.Get(document.id) : this.core.Skins.Get(document.id);
        if (existing !== undefined) throw "A document with this ID already exists. Import into the editor to update a component.";
    }
    private Accept(): void {
        if (InCombatLockdown()) return;
        this.text = this.input?.Value ?? this.text;
        try {
            const transfer = this.transfer.Decode(this.text, this.kind);
            this.CheckDestination(transfer.document);
            if (this.includeBindings && transfer.bindings.length > 0) {
                this.conflicts = this.transfer.Conflicts(transfer);
                if (this.conflicts.length > 0) { this.pending = transfer; this.Open(); return; }
            }
            this.Commit(transfer, this.includeBindings ? "replace" : "none");
        } catch (failure) { this.message = String(failure); this.Open(); }
    }
    private Confirm(policy: BindingImportPolicy): void {
        if (InCombatLockdown() || this.pending === undefined) return;
        try {
            const current = this.transfer.Conflicts(this.pending);
            const signature = (conflicts: BindingConflict[]) => conflicts.map(conflict => conflict.message).sort().join("\n");
            if (policy === "replace" && signature(current) !== signature(this.conflicts)) {
                this.conflicts = current; this.message = "Bindings changed while this dialog was open. Review the current conflicts.";
                this.Open(); return;
            }
            this.Commit(this.pending, policy);
        } catch (failure) { this.pending = undefined; this.message = String(failure); this.Open(); }
    }
    private Commit(transfer: TransferPayload, policy: BindingImportPolicy): void {
        if (InCombatLockdown()) throw "Import after combat.";
        this.CheckDestination(transfer.document);
        this.transfer.PrepareClickCast(transfer);
        if (this.imported !== undefined) this.imported(transfer.document);
        else if (transfer.document.kind === "preset") this.core.Presets.Save(transfer.document);
        else this.core.Skins.Save(transfer.document);
        this.transfer.ApplyBindings(transfer, policy);
        this.pending = undefined; this.conflicts = [];
        this.core.RefreshCustomization(); this.window.Close();
    }
    private Control(text: string, width: number, action: () => void) {
        return <Button width={width} height={30} onClick={action}
            decorations={{ background: new Background({ color: this.core.Theme.colors.border }) }}>
            <Label text={text} align="CENTER" fontSize={11} />
        </Button>;
    }
    private ConflictView() {
        const conflicts = this.conflicts;
        return <FlowLayout padding={16} gap={12} clickThrough={false}
            decorations={{ background: new Background({ color: this.core.Theme.colors.background }), border: new Border({ thickness: 1, color: this.core.Theme.colors.border }) }}>
            <Label height={28} text="Keybinding conflicts" fontSize={20} onMount={frame => this.window.BindDragHandle(frame)} />
            <Label height={52} fontSize={11} text={this.message.startsWith("Bindings changed") ? this.message
                : conflicts.length + " conflicting assignments. Replace them, import no keys, or skip conflicts and keep current bindings."} />
            <Cell height={188} clickThrough={false} onMount={frame => {
                const viewport = new ScrollHost(frame);
                const content = wuira.Mount(<FlowLayout width={frame.GetWidth()} height={0} sizing="content" gap={4}>
                    {conflicts.map(conflict => <Label height={64} fontSize={11} text={conflict.message} />)}
                </FlowLayout>, undefined, viewport.Frame);
                viewport.SetContent(content!);
                return () => { if (content !== undefined) wuira.Unmount(content); viewport.Dispose(); };
            }} />
            <FlowLayout height={30} direction="horizontal" gap={8}>
                {this.Control("Replace bindings", 150, () => this.Confirm("replace"))}
                {this.Control("Import without keys", 170, () => this.Confirm("none"))}
                {this.Control("Skip conflicts", 145, () => this.Confirm("skip"))}
                {this.Control("Cancel", 90, () => { this.pending = undefined; this.window.Close(); })}
            </FlowLayout>
        </FlowLayout>;
    }
    private View() {
        const colors = this.core.Theme.colors;
        return <FlowLayout padding={16} gap={12} clickThrough={false}
            decorations={{ background: new Background({ color: colors.background }), border: new Border({ thickness: 1, color: colors.border }) }}>
            <Label height={28} text={(this.exporting ? "Export " : "Import ") + (this.kind === "preset" ? "Component" : "Blizzard Skin")} fontSize={20}
                onMount={frame => this.window.BindDragHandle(frame)} />
            <Label height={52} text={this.message} fontSize={11} color={colors.muted} />
            {this.kind === "preset" ? this.Control((this.exporting ? "Export" : "Import") + " keybindings: " + (this.includeBindings ? "Yes" : "No"), 240, () => this.ToggleBindings()) : []}
            <Cell height={80} clickThrough={false} decorations={{ background: new Background({ color: colors.surface }) }}
                onMount={frame => { const input = new TextInput(frame, { text: this.text, onEscape: () => this.window.Close() }); this.input = input;
                    return () => { input.Dispose(); if (this.input === input) this.input = undefined; }; }} />
            <FlowLayout height={30} direction="horizontal" gap={12}>
                {!this.exporting ? this.Control("Import", 120, () => this.Accept()) : []}
                {this.Control("Close", 120, () => this.window.Close())}
            </FlowLayout>
        </FlowLayout>;
    }
    private Open(): void {
        this.window.Open(() => this.pending === undefined ? this.View() : this.ConflictView());
        this.input?.Focus(this.exporting);
    }
}
