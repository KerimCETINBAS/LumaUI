import { UI } from "wuira/ui";
import { wuira } from "wuira";
import { Window, FlowLayout, Cell, Button, Label, Background, Border, ScrollHost, TextInput, Icon } from "wuira/ui";
import type { LumaCoreAPI, PlayerActionCategory, PlayerActionList, PlayerAction, ClickCastAction } from "../../core/contract";

/** The picker owns its catalog only while open; choosing an action persists an ID or macro name. */
export class ActionPicker {
    private readonly window = new Window({ width: 560, height: 480 });
    private catalog?: PlayerActionList;
    private stop?: () => void;
    private input?: TextInput;
    private search = "";
    private category: PlayerActionCategory = "spell";
    private selected?: (action: ClickCastAction) => void;
    private results?: wuiraNativeFrame;
    private content?: wuiraNativeFrame;
    private scroll?: ScrollHost;
    private readonly combat = CreateFrame("Frame", undefined, UIParent);
    public constructor(private readonly core: LumaCoreAPI) {
        this.window.Frame.SetFrameStrata("FULLSCREEN_DIALOG");
        this.window.Frame.HookScript("OnHide", () => this.Release());
        this.combat.RegisterEvent("PLAYER_REGEN_DISABLED"); this.combat.SetScript("OnEvent", () => this.Close());
    }
    public Open(selected: (action: ClickCastAction) => void): void {
        if (InCombatLockdown()) return;
        this.Close(); this.selected = selected; this.search = ""; this.category = "spell";
        this.catalog = this.core.Helpers.PlayerActions(); this.stop = this.catalog.onChange(() => this.RefreshResults());
        this.Render();
    }
    public Close(): void { this.window.Close(); this.Release(); }
    private Release(): void { this.stop?.(); this.stop = undefined; this.catalog?.Dispose(); this.catalog = undefined; this.selected = undefined; }
    public Dispose(): void { this.Close(); this.window.Dispose(); this.combat.UnregisterAllEvents(); this.combat.SetScript("OnEvent", undefined); }
    private Choose(item: PlayerAction): void { const selected = this.selected; this.Close(); selected?.({ ...item.action }); }
    private RefreshResults(): void {
        if (this.results === undefined || this.scroll === undefined || this.catalog === undefined) return;
        const query = this.search.trim().toLowerCase();
        const entries = this.catalog.Value.filter(item => item.category === this.category && (item.name.toLowerCase().includes(query) || (item.detail ?? "").toLowerCase().includes(query))).slice(0, 48);
        const colors = this.core.Theme.colors, width = 508;
        const view = wuira.Mount(<FlowLayout width={width} height={Math.max(40, entries.length * 40)} gap={4}>
            {entries.length === 0 ? <Label height={40} text="No matching character actions. Learn a spell, equip a usable item, carry a consumable or create a named macro." fontSize={11} /> : entries.map(item =>
                <Button width={width} height={36} onClick={() => this.Choose(item)} decorations={{ background: new Background({ color: colors.border }) }}>
                    <FlowLayout direction="horizontal" gap={8} padding={2}>
                        <Icon width={32} height={32} texture={item.icon ?? "Interface\\Icons\\INV_Misc_QuestionMark"} />
                        <Label width={width - 48} height={32} fontSize={11} text={item.name + (item.detail === undefined ? "" : " · " + item.detail)} />
                    </FlowLayout>
                </Button>)}
        </FlowLayout>, undefined, this.scroll.Frame);
        const previous = this.content; this.content = view; this.scroll.SetContent(view!, 0); if (previous !== undefined) wuira.Unmount(previous);
    }
    private Render(): void {
        const colors = this.core.Theme.colors;
        const categories: { id: PlayerActionCategory; text: string }[] = [{ id: "spell", text: "Spells" }, { id: "item", text: "Items" }, { id: "consumable", text: "Consumables" }, { id: "macro", text: "Macros" }];
        this.window.Open(<FlowLayout width={560} height={480} padding={14} gap={8} clickThrough={false}
            decorations={{ background: new Background({ color: colors.background }), border: new Border({ thickness: 1, color: colors.border }) }}>
            <Label height={28} text="Choose action" fontSize={18} color={colors.accent} onMount={frame => this.window.BindDragHandle(frame)} />
            <FlowLayout height={28} direction="horizontal" gap={4}>
                {categories.map(category => <Button width={130} height={28} onClick={() => { this.search = this.input?.Value ?? this.search; this.category = category.id; this.Render(); }}
                    decorations={{ background: new Background({ color: this.category === category.id ? colors.border : colors.surface }) }}>
                    <Label text={category.text} fontSize={11} align="CENTER" color={this.category === category.id ? colors.accent : colors.text} />
                </Button>)}
            </FlowLayout>
            <Cell height={28} decorations={{ background: new Background({ color: colors.surface }) }} onMount={host => {
                const input = new TextInput(host, { text: this.search, maxBytes: 128, onEscape: () => this.Close() }); this.input = input;
                const native = input.Frame as typeof input.Frame & { SetScript(script: "OnTextChanged", handler: (() => void) | undefined): void };
                native.SetScript("OnTextChanged", () => { this.search = input.Value; this.RefreshResults(); });
                input.Focus(false); return () => { native.SetScript("OnTextChanged", undefined); input.Dispose(); if (this.input === input) this.input = undefined; };
            }} />
            <Cell height={292} clickThrough={false} onMount={host => {
                const scroll = new ScrollHost(host); this.results = host; this.scroll = scroll; this.RefreshResults();
                return () => { if (this.results === host) { if (this.content !== undefined) wuira.Unmount(this.content); this.content = undefined; this.results = undefined; this.scroll = undefined; } scroll.Dispose(); };
            }} />
            <Button height={28} onClick={() => this.Close()} decorations={{ background: new Background({ color: colors.border }) }}><Label text="Cancel" align="CENTER" fontSize={11} /></Button>
        </FlowLayout>);
    }
}
