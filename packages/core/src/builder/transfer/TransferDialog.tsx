import { UI } from "wuira/ui";
import { wuira } from "wuira";
import { Window, TextInput, ScrollHost, FlowLayout, Cell, Label, Button, Background, Border } from "wuira/ui";
import type { LumaCoreAPI, BuilderDocument, ClickCastPresetDocument } from "../../core/contract";
import { PresetTransfer } from "./PresetTransfer";
import type { TransferPayload, BindingConflict, BindingImportPolicy } from "./PresetTransfer";

/** Copy/paste transport and optional keybinding metadata belong to the master. */
export class TransferDialog {
    private readonly window = new Window({ width: 680, height: 400 });
    private readonly transfer: PresetTransfer;
    private input?: TextInput;
    private componentName = "";
    private nameInput?: TextInput;
    private validateInput?: () => void;
    private showInputError?: (message: string) => void;
    private includeClickCast = true;
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
    public constructor(private readonly core: LumaCoreAPI) {
        this.transfer = new PresetTransfer(core);
        this.window.Frame.SetFrameStrata("FULLSCREEN_DIALOG");
        this.window.Frame.SetFrameLevel(100);
    }
    public Import(kind: "preset" | "skin", callback?: (document: BuilderDocument) => void, importString?: string): void {
        if (InCombatLockdown()) { console.log("LumaUI: import after combat."); return; }
        this.includeClickCast = true;
        this.componentName = "";
        this.kind = kind; this.imported = callback; this.exporting = false; this.text = importString ?? "";
        this.includeBindings = false; this.exportDocument = undefined; this.pending = undefined; this.conflicts = [];
        this.message = importString === undefined
            ? "Paste a LumaUI " + (kind === "preset" ? "component" : "skin") + " string. Imported documents start disabled."
            : "Built-in preset ready. Optional name field below; leave empty to keep the imported identity. Import copy saves a separate component.";
        this.Open();
    }
    public Export(document: BuilderDocument, clickCastPresets: readonly ClickCastPresetDocument[] = []): void {
        if (InCombatLockdown()) return;
        this.includeClickCast = true;
        this.kind = document.kind; this.imported = undefined; this.exporting = true;
        this.includeBindings = false; this.exportDocument = document; this.pending = undefined; this.conflicts = [];
        this.exportClickCast = clickCastPresets;
        this.text = this.transfer.Export(document, false, clickCastPresets);
        this.message = "Choose whether to include character keybindings, then press Ctrl+C to copy.";
        this.Open();
    }
    private ToggleClickCast(): void {
        if (InCombatLockdown()) return;
        this.componentName = this.nameInput?.Value ?? this.componentName;
        if (!this.exporting) this.text = this.input?.Value ?? this.text;
        this.includeClickCast = !this.includeClickCast;
        if (this.exportDocument !== undefined) this.text = this.transfer.Export(this.exportDocument, this.includeBindings, this.exportClickCast, this.includeClickCast);
        this.Open();
    }
    private ToggleBindings(): void {
        if (InCombatLockdown()) return;
        this.componentName = this.nameInput?.Value ?? this.componentName;
        if (!this.exporting) this.text = this.input?.Value ?? this.text;
        this.includeBindings = !this.includeBindings;
        try {
            if (this.exportDocument !== undefined) this.text = this.transfer.Export(this.exportDocument, this.includeBindings, this.exportClickCast, this.includeClickCast);
            this.message = this.exporting ? "Press Ctrl+C to copy the selected string."
                : this.includeBindings && this.imported !== undefined
                    ? "Selected keys are saved when imported. The editor layout stays a draft until Save."
                    : this.includeBindings ? "Keybindings are optional. Conflicts require a choice before import."
                    : "Only the component will be imported; current keybindings stay unchanged.";
        } catch (failure) { this.message = String(failure); }
        this.Open();
    }
    private CheckDestination(document: BuilderDocument): void {
        if (this.imported !== undefined) return;
        const existing = document.kind === "preset" ? this.core.Presets.Get(document.id) : this.core.Skins.Get(document.id);
        if (existing !== undefined) throw "A document with this ID already exists. Use Import copy to add another instance, or import into the editor to update it.";
    }
    private Accept(asCopy = false): void {
        if (InCombatLockdown()) return;
        this.text = this.input?.Value ?? this.text;
        try {
            const transfer = this.transfer.Decode(this.text, this.kind);
            const requestedName = (this.nameInput?.Value ?? this.componentName).trim();
            if (transfer.document.kind === "preset" && this.imported === undefined && (asCopy || requestedName !== "")) {
                const oldID = transfer.document.id;
                const identity = this.core.Presets.Identity(requestedName !== "" ? requestedName : transfer.document.name);
                if (identity.duplicate && !asCopy) throw "That name already exists. Choose a different name, or Import copy to save as " + identity.name;
                transfer.document.id = identity.id; transfer.document.name = identity.name;
                for (const binding of transfer.bindings) if (binding.collection === oldID) binding.collection = identity.id;
            } else if (asCopy) {
                const original = transfer.document.id; let index = 1, id = original.slice(0,80) + "-" + index;
                while (this.core.Skins.Get(id) !== undefined) { index++; id = original.slice(0,80) + "-" + index; }
                transfer.document.id = id; transfer.document.name = transfer.document.name.slice(0,80) + " (" + index + ")";
            }
            this.CheckDestination(transfer.document);
            if (this.includeBindings && transfer.bindings.length > 0) {
                this.conflicts = this.transfer.Conflicts(transfer);
                if (this.conflicts.length > 0) { this.pending = transfer; this.Open(); return; }
            }
            this.Commit(transfer, this.includeBindings ? "replace" : "none");
        } catch (failure) { this.showInputError?.(String(failure)); }
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
        if (this.includeClickCast) this.transfer.PrepareClickCast(transfer);
        else this.transfer.OmitClickCast(transfer);
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
            decorations={{ background: new Background({ color: { ...this.core.Theme.colors.background, a: 1 } }), border: new Border({ thickness: 1, color: this.core.Theme.colors.border }) }}>
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
        const border = new Border({ thickness: 1, color: colors.border });
        const background = new Background({ color: { ...colors.background, a: 1 } });
        const outline = new Border({ thickness: 1, color: colors.border });
        let surface: wuiraNativeFrame | undefined;
        let inputFrame: wuiraNativeFrame | undefined, errorText: wuiraNativeFontString | undefined;
        let tail: wuiraNativeFrame | undefined, content: wuiraNativeFrame | undefined;
        let delay = 0, tailReady = false, previewVisible = false;
        const errorColor = { r: 1, g: .25, b: .25, a: 1 };
        const feedback = (message: string, invalid = false) => {
            errorText?.SetText(message);
            const color = invalid ? errorColor : colors.muted;
            errorText?.SetTextColor(color.r, color.g, color.b, 1);
            border.props.color = invalid ? errorColor : colors.border;
            if (inputFrame !== undefined) { border.dispose(); border.mount(inputFrame, inputFrame.GetWidth(), inputFrame.GetHeight()); }
        };
        const renderTail = (document?: import("../../core/contract").PresetDocument) => {
            if (tail === undefined || document === undefined && tailReady && !previewVisible) return;
            tailReady = true; previewVisible = document !== undefined;
            if (content !== undefined) { wuira.Unmount(content); content = undefined; }
            const previewHeight = document === undefined ? 0 : Math.max(100, Math.min(280, UIParent.GetHeight() - 480));
            const height = 440 + (document === undefined ? 0 : previewHeight + 12);
            this.window.Frame.SetSize(this.window.Frame.GetWidth(), height);
            // wuira layouts are measured on mount; resize the opaque host without replacing its inputs.
            if (surface !== undefined && surface.GetHeight() !== height) {
                surface.SetSize(surface.GetWidth(), height);
                background.dispose(); background.mount(surface, surface.GetWidth(), height);
                outline.dispose(); outline.mount(surface, surface.GetWidth(), height);
            }
            content = wuira.Mount(<FlowLayout width={tail.GetWidth()} height={30 + (document === undefined ? 0 : previewHeight + 12)} gap={12}>
                {document === undefined ? [] : this.core.Preview({ document, width: tail.GetWidth(), height: previewHeight, zoom: "fit" })}
                <FlowLayout height={30} direction="horizontal" gap={12}>
                    {!this.exporting ? this.Control("Import", 120, () => this.Accept()) : []}
                    {!this.exporting && this.imported === undefined ? this.Control("Import copy", 140, () => this.Accept(true)) : []}
                    {this.Control("Close", 120, () => this.window.Close())}
                </FlowLayout>
            </FlowLayout>, undefined, tail);
        };
        const validate = () => {
            if (this.exporting || InCombatLockdown()) return;
            this.text = this.input?.Value ?? this.text;
            if (this.text.trim() === "") { renderTail(); feedback(""); return; }
            try {
                const transfer = this.transfer.Decode(this.text, this.kind);
                const document = transfer.document;
                const headless = document.kind === "preset" && this.core.Presets.IsHeadless(document);
                renderTail(document.kind === "preset" && !headless ? document : undefined);
                feedback(headless
                    ? "Valid component · no visual output." : "Valid string · ready to import.");
            } catch (failure) { renderTail(); feedback(String(failure), true); }
        };
        const showError = (message: string) => feedback(message, true);
        return <FlowLayout padding={16} gap={12} clickThrough={false}
            decorations={{ background, border: outline }} onMount={frame => { surface = frame; return () => { surface = undefined; }; }}>
            <Label height={28} text={(this.exporting ? "Export " : "Import ") + (this.kind === "preset" ? "Component" : "Blizzard Skin")} fontSize={20}
                onMount={frame => this.window.BindDragHandle(frame)} />
            <Label height={40} text={this.message} fontSize={11} color={colors.muted} />
            {this.kind === "preset" ? <FlowLayout height={30} direction="horizontal" gap={12}>
                {this.Control((this.exporting ? "Export" : "Import") + " keybindings: " + (this.includeBindings ? "Yes" : "No"), 240, () => this.ToggleBindings())}
                {this.Control((this.exporting ? "Export" : "Import") + " Click Cast: " + (this.includeClickCast ? "Yes" : "No"), 240, () => this.ToggleClickCast())}
            </FlowLayout> : []}
            {!this.exporting && this.kind === "preset" && this.imported === undefined ? <Label height={17} text="Component name (optional)" fontSize={11} /> : []}
            {!this.exporting && this.kind === "preset" && this.imported === undefined ? <Cell height={28} onMount={frame => {
                const input = new TextInput(frame, { text: this.componentName, onEscape: () => this.window.Close() }); this.nameInput = input;
                return () => { this.componentName = input.Value; input.Dispose(); if (this.nameInput === input) this.nameInput = undefined; };
            }} /> : []}
            <Cell height={80} clickThrough={false} decorations={{ background: new Background({ color: { ...colors.surface, a: 1 } }), border }}
                onMount={frame => {
                    inputFrame = frame;
                    const input = new TextInput(frame, { text: this.text, onEscape: () => this.window.Close() }); this.input = input;
                    const native = input.Frame as typeof input.Frame & { SetScript(script: "OnTextChanged", handler: ((this: void) => void) | undefined): void };
                    if (!this.exporting) {
                        native.SetScript("OnTextChanged", () => {
                            this.text = input.Value; delay = .2;
                            renderTail(); feedback(this.text.trim() === "" ? "" : "Checking string...");
                        });
                        input.Frame.SetScript("OnUpdate", (_frame, elapsed) => {
                            if (delay <= 0 || InCombatLockdown()) return;
                            delay -= elapsed; if (delay <= 0) validate();
                        });
                    }
                    return () => {
                        native.SetScript("OnTextChanged", undefined); input.Frame.SetScript("OnUpdate", undefined);
                        input.Dispose(); inputFrame = undefined; if (this.input === input) this.input = undefined;
                    };
                }} />
            <Cell height={36} onMount={frame => {
                errorText = frame.CreateFontString(undefined, "OVERLAY"); errorText.SetAllPoints(frame);
                errorText.SetFont("Fonts\\FRIZQT__.TTF", 11, ""); errorText.SetJustifyH("LEFT");
                return () => { errorText = undefined; };
            }} />
            <Cell height={30} onMount={frame => {
                tail = frame; renderTail(); this.validateInput = validate; this.showInputError = showError;
                return () => {
                    if (content !== undefined) wuira.Unmount(content);
                    content = undefined; tail = undefined;
                    if (this.validateInput === validate) this.validateInput = undefined;
                    if (this.showInputError === showError) this.showInputError = undefined;
                };
            }} />
        </FlowLayout>;
    }
    private Open(): void {
        this.window.Frame.SetSize(Math.min(680, UIParent.GetWidth() - 40), 400);
        this.window.Open(() => this.pending === undefined ? this.View() : this.ConflictView());
        this.validateInput?.();
        this.input?.Focus(this.exporting);
    }
}
