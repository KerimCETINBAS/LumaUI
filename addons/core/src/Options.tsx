import { UI, wuira, AddonSettings } from "wuira";
import type { CommandCallback } from "wuira";
import { StoreRegistry } from "wuira/store";
import { Cell, FlowLayout, Button, Label, Background, Border } from "wuira/ui";
import { LumaSettings } from "./settings";
import { CustomizationWindow } from "./CustomizationWindow";
import { installMinimapLauncher } from "./MinimapLauncher";
import type { CustomizationPage } from "./core/contract";
import { darkTheme } from "./theme/dark";
import type { EditMode, LumaModule } from "./core/contract";

function Control({ text, onClick }: { text: string; onClick: () => void }) {
    return <Button width={280} height={34} onClick={onClick}
        decorations={{ background: new Background({ color: darkTheme.colors.surface }),
            border: new Border({ thickness: 1, color: darkTheme.colors.border }) }}>
        <Label text={text} fontSize={12} align="CENTER" color={darkTheme.colors.text} />
    </Button>;
}

function OptionsView({ options }: { options: LumaOptions }) {
    return <FlowLayout width={560} height={260} padding={20} gap={16}>
        <Label height={32} text="LumaUI" fontSize={24} color={darkTheme.colors.accent} />
        <Label height={42} text="Customize your interface in the standalone LumaUI dashboard." fontSize={12} />
        <Control text="Open LumaUI" onClick={() => options.OpenCustomization()} />
        <Label height={42} text="You can also use /luma or the L button beside the minimap." fontSize={11} color={darkTheme.colors.muted} />
    </FlowLayout>;
}

function EditToolbar({ options }: { options: LumaOptions }) {
    return <Cell width={560} height={100} mode="absolute" anchor="TOP" x={0} y={60}
        decorations={{ background: new Background({ color: darkTheme.colors.background }),
            border: new Border({ thickness: 1, color: darkTheme.colors.accent }) }}>
        <FlowLayout padding={10} direction="vertical" gap={6}>
            <Label height={18} text={() => options.Mode === "unlock" ? "LumaUI - Layout unlocked" : "LumaUI - Keybind mode"}
                fontSize={14} color={darkTheme.colors.accent} />
            <Label height={18} fontSize={11} text={options.Mode === "unlock"
                ? "Drag the blue handles. Changes are saved for this character."
                : "Hover a button and press a key. Delete: clear binding. Escape: done."} />
            <Button width={100} height={26} onClick={() => options.SetMode("locked")}
                decorations={{ background: new Background({ color: darkTheme.colors.surface }),
                    border: new Border({ thickness: 1, color: darkTheme.colors.border }) }}>
                <Label text="Done" align="CENTER" fontSize={12} />
            </Button>
        </FlowLayout>
    </Cell>;
}

/** Shared editing policy. Feature addons own their controls. */
export class LumaOptions {
    public readonly store = new StoreRegistry({ addon: "LumaUI", variable: "LumaUISettings" });
    private mode: EditMode = "locked";
    private readonly modules = new Map<string, LumaModule>();
    private toolbar?: wuiraNativeFrame;
    private page?: AddonSettings;
    private readonly customization = new CustomizationWindow(this);
    private readonly keyboard = CreateFrame("Frame", undefined, UIParent);

    public get Mode(): EditMode { return this.mode; }
    public get Settings() { return this.store.get(LumaSettings); }

    public constructor() {
        this.keyboard.EnableMouse(false);
        this.keyboard.EnableKeyboard(false);
        this.keyboard.Hide();
        this.keyboard.RegisterEvent("PLAYER_REGEN_DISABLED");
        this.keyboard.SetScript("OnEvent", () => { this.SetMode("locked"); this.customization.Close(); });
        this.keyboard.SetScript("OnKeyDown", (_frame, key) => {
            if (InCombatLockdown()) return;
            this.keyboard.SetPropagateKeyboardInput(key !== "ESCAPE");
            if (key === "ESCAPE") this.SetMode("locked");
        });
    }

    public RegisterModule(id: string, module: LumaModule): () => void {
        if (this.modules.has(id)) throw "LumaUI: module already registered: " + id;
        this.modules.set(id, module);
        module.SetMode(this.mode);
        return () => {
            if (this.modules.get(id) !== module) return;
            module.SetMode("locked");
            this.modules.delete(id);
        };
    }

    public RegisterPage(page: CustomizationPage): () => void { return this.customization.RegisterPage(page); }
    public OpenCustomization(id?: string): void {
        if (InCombatLockdown()) { console.log("LumaUI: open customization after combat."); return; }
        this.SetMode("locked");
        this.page?.Close();
        this.customization.Open(id);
    }
    public CloseCustomization(): void { this.customization.Close(); }
    public RefreshCustomization(): void { this.customization.Refresh(); }

    public Install(): void {
        this.page = new AddonSettings("LumaUI", () => <OptionsView options={this} />);
        const command: CommandCallback = (...args) => {
            const command = (args.at(0) ?? "").toLowerCase();
            if (command === "unlock") this.SetMode("unlock");
            else if (command === "bind" || command === "keybind") this.SetMode("keys");
            else if (command === "lock") this.SetMode("locked");
            else if (command === "reset") this.Reset();
            else this.OpenCustomization(["builtins", "starters"].includes(command) ? "builtin-presets" : command === "actions" ? "library" : command === "" ? undefined : command);
        };
        wuira.registerCommand("/luma", command);
        wuira.registerCommand("/lumaui", command);
        installMinimapLauncher(() => this.OpenCustomization());
    }

    public SetMode(mode: EditMode): void {
        if (mode !== "locked" && InCombatLockdown()) { console.log("LumaUI: editing is unavailable during combat."); return; }
        this.mode = mode;
        if (mode !== "locked") this.customization.Close();
        for (const module of this.modules.values()) module.SetMode(mode);
        this.keyboard.EnableKeyboard(mode === "unlock");
        if (mode === "unlock") {
            this.keyboard.SetPropagateKeyboardInput(true);
            this.keyboard.Show();
        } else this.keyboard.Hide();
        if (this.toolbar !== undefined) { wuira.Unmount(this.toolbar); this.toolbar = undefined; }
        if (mode === "locked") return;
        this.page?.Close();
        this.toolbar = wuira.Mount(() => <EditToolbar options={this} />);
    }

    public Reset(): void {
        if (InCombatLockdown()) { console.log("LumaUI: reset is unavailable during combat."); return; }
        this.SetMode("locked");
        this.store.set(LumaSettings, () => new LumaSettings());
        for (const module of this.modules.values()) module.Reset();
        console.log("LumaUI editing settings reset.");
    }
}
