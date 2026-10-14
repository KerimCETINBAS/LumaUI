import { UI } from "wuira";
import { Window, TextInput, FlowLayout, Cell, Label, Button, Background, Border } from "wuira/ui";
import type { LumaCoreAPI, BuilderDocument } from "../core/contract";

/** Copy/paste transport belongs to the master, so the visual editor is optional. */
export class TransferDialog {
    private readonly window = new Window({ width: 600, height: 230 });
    private input?: TextInput;
    private text = "";
    private message = "";
    private kind: "preset" | "skin" = "preset";
    private exporting = false;
    private imported?: (document: BuilderDocument) => void;
    public constructor(private readonly core: LumaCoreAPI) {}
    public Import(kind: "preset" | "skin", callback?: (document: BuilderDocument) => void): void {
        if (InCombatLockdown()) { console.log("LumaUI: import after combat."); return; }
        this.kind = kind; this.imported = callback; this.exporting = false; this.text = "";
        this.message = "Paste a LumaUI " + kind + " string. Imported documents start disabled.";
        this.Open();
    }
    public Export(document: BuilderDocument): void {
        if (InCombatLockdown()) return;
        this.kind = document.kind; this.imported = undefined; this.exporting = true;
        this.text = document.kind === "preset" ? this.core.Presets.Export(document) : this.core.Skins.Export(document);
        this.message = "Press Ctrl+C to copy the selected string."; this.Open();
    }
    private Accept(): void {
        if (InCombatLockdown()) return;
        this.text = this.input?.Value ?? "";
        try {
            const document = this.kind === "preset" ? this.core.Presets.Import(this.text) : this.core.Skins.Import(this.text);
            if (this.imported !== undefined) this.imported(document);
            else {
                const existing = document.kind === "preset" ? this.core.Presets.Get(document.id) : this.core.Skins.Get(document.id);
                if (existing !== undefined) throw "A document with this ID already exists. Import into the editor to update a preset.";
                if (document.kind === "preset") this.core.Presets.Save(document); else this.core.Skins.Save(document);
                this.core.RefreshCustomization();
            }
            this.window.Close();
        } catch (failure) { this.message = String(failure); this.Open(); }
    }
    private Open(): void {
        const colors = this.core.Theme.colors;
        this.window.Open(() => <FlowLayout padding={16} gap={12} clickThrough={false}
            decorations={{ background: new Background({ color: colors.background }), border: new Border({ thickness: 1, color: colors.border }) }}>
            <Label height={28} text={(this.exporting ? "Export " : "Import ") + (this.kind === "preset" ? "Preset" : "Blizzard Skin")} fontSize={20}
                onMount={frame => this.window.BindDragHandle(frame)} />
            <Label height={44} text={this.message} fontSize={11} color={colors.muted} />
            <Cell height={44} clickThrough={false} decorations={{ background: new Background({ color: colors.surface }) }}
                onMount={frame => { const input = new TextInput(frame, { text: this.text, onEscape: () => this.window.Close() }); this.input = input;
                    return () => { input.Dispose(); if (this.input === input) this.input = undefined; }; }} />
            <FlowLayout height={30} direction="horizontal" gap={12}>
                <Button width={120} condition={!this.exporting} onClick={() => this.Accept()}
                    decorations={{ background: new Background({ color: colors.border }) }}><Label text="Import" align="CENTER" /></Button>
                <Button width={120} onClick={() => this.window.Close()}
                    decorations={{ background: new Background({ color: colors.surface }) }}><Label text="Close" align="CENTER" /></Button>
            </FlowLayout>
        </FlowLayout>);
        this.input?.Focus(this.exporting);
    }
}
