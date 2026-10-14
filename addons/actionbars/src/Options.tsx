import { UI, wuira } from "wuira";
import { FlowLayout, Button, Label } from "wuira/ui";
import type { EditMode, LumaModule, CustomizationContext } from "lumaui/core";
import { Core } from "./core";
import { ActionBarSettings } from "./settings";
function SettingsView({ options, width, height }: CustomizationContext & { options: ActionBarOptions }) {
    return <FlowLayout width={width} height={height} padding={20} gap={12}>
        <Label height={32} text="Action bar collection" fontSize={24} color={Core.Theme.colors.accent} />
        <Button width={280} height={34} onClick={() => { const collection = Core.Presets.Get("action-bars"); if (collection !== undefined) Core.EditPreset(collection); }}><Label text="Edit collection" /></Button>
        <Button width={280} height={34} onClick={() => Core.SetMode("unlock")}><Label text="Unlock layout" /></Button>
        <Button width={280} height={34} onClick={() => Core.SetMode("keys")}><Label text="Keybind mode" /></Button>
        <Label height={42} text="Layout, sources and key bindings are stored in the collection. Reload keeps your edits." />
        <Button width={280} height={34} onClick={() => options.Reset()}><Label text="Restore starter collection" /></Button>
        <Label height={42} text="Native bar slots: /lumaclearbars and /lumarestorebars. Save a new backup with /reload before clearing." />
    </FlowLayout>;
}
export class ActionBarOptions implements LumaModule {
    public onReset?: () => void;
    public get Settings() { return Core.Store.get(ActionBarSettings); }
    public constructor() {
        if (!this.Settings.migrated) {
            const legacy = Core.GetLegacyActionSettings();
            Core.Store.set(ActionBarSettings, value => {
                if (legacy.bindings !== undefined) value.bindings = { ...legacy.bindings };
                if (legacy.position !== undefined && !legacy.position.followPlayer) value.position = { x: legacy.position.x, y: legacy.position.y };
                return value;
            });
        }
    }
    public Install(): void {
        Core.RegisterPage({ id: "actions", title: "Action Bars", summary: "Edit the saved action-bar collection and native bar options.",
            Render: context => <SettingsView options={this} width={context.width} height={context.height} /> });
        wuira.registerCommand("/lumaactions", (...args) => {
            const command = (args.at(0) ?? "").toLowerCase();
            if (command === "bind" || command === "keybind") Core.SetMode("keys");
            else if (command === "unlock") Core.SetMode("unlock");
            else if (command === "lock") Core.SetMode("locked");
            else if (command === "reset") this.Reset();
            else Core.OpenCustomization("actions");
        });
        Core.RegisterModule("actions", this);
    }
    public SetMode(_mode: EditMode): void {}
    public Reset(): void {
        if (InCombatLockdown()) return;
        Core.SetMode("locked");
        Core.Store.set(ActionBarSettings, () => { const settings = new ActionBarSettings(); settings.migrated = true; return settings; });
        this.onReset?.();
    }
}
