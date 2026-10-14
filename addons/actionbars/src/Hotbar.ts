import { KnownSpells } from "wuira/datasources";
import { Core } from "./core";
import { ActionBarSettings } from "./settings";
import { createActionRows } from "./actionDefinitions";
import { createActionCollection } from "./Collection";

/** One-time migration/seeding; live rendering belongs entirely to the master collection runtime. */
export class Hotbar {
    private known?: KnownSpells;
    private stopKnown?: () => void;
    private readonly ready = CreateFrame("Frame", undefined, UIParent);
    private resetting = false;
    private refreshing = false;
    public constructor() {
        this.ready.RegisterEvent("PLAYER_REGEN_ENABLED");
        this.ready.SetScript("OnEvent", () => this.Refresh());
        this.Refresh();
    }
    public Refresh(): void {
        if (InCombatLockdown() || this.refreshing) return;
        const settings = Core.Store.get(ActionBarSettings);
        if (settings.collectionSeeded && !this.resetting) { this.Stop(); return; }
        if (Core.Presets.Get("action-bars") !== undefined && !this.resetting) {
            Core.Store.set(ActionBarSettings, value => { value.collectionSeeded = true; return value; }); this.Stop(); return;
        }
        if (this.known === undefined) { this.known = new KnownSpells(); this.stopKnown = this.known.onChange(() => this.Refresh()); }
        if (this.known.Status !== "ready" || this.known.Value.length === 0) return;
        this.refreshing = true;
        try {
            const rows = createActionRows(this.known, settings.bindings);
            const document = createActionCollection(rows, settings.position);
            const legacy = Core.GetLegacyActionSettings();
            if (!settings.migrated && legacy.position?.followPlayer) {
                document.root.props.x = legacy.playerPosition.x;
                document.root.props.y = legacy.playerPosition.y + legacy.playerHeight / 2 + 8 + (document.root.props.height as number) / 2;
            }
            Core.Presets.Mount(document);
            Core.Presets.Save(document, true);
            Core.Store.set(ActionBarSettings, value => { value.collectionSeeded = true; value.migrated = true; return value; });
            this.resetting = false; this.Stop();
        } finally { this.refreshing = false; }
    }
    public Reset(): void { if (InCombatLockdown()) return; this.ready.RegisterEvent("PLAYER_REGEN_ENABLED"); this.ready.SetScript("OnEvent", () => this.Refresh()); this.resetting = true; this.Refresh(); }
    private Stop(): void {
        this.stopKnown?.(); this.stopKnown = undefined; this.known?.Dispose(); this.known = undefined;
        this.ready.UnregisterAllEvents(); this.ready.SetScript("OnEvent", undefined);
    }
    public Dispose(): void { this.Stop(); }
}
