import { UI, wuira } from "wuira";
import { Button, Label, Background, Border } from "wuira/ui";
import { darkTheme } from "./theme/dark";

/** A small launcher adjacent to the native minimap; all entries open the same window. */
export function installMinimapLauncher(open: () => void): () => void {
    const listener = CreateFrame("Frame", undefined, UIParent);
    let launcher: wuiraNativeFrame | undefined;
    const attach = () => {
        if (launcher !== undefined || InCombatLockdown()) return;
        const minimap = _G.Minimap as wuiraNativeFrame | undefined;
        if (minimap === undefined) return;
        launcher = wuira.Mount(() =>
            <Button width={28} height={28} anchor="TOPLEFT" relativeAnchor="BOTTOMLEFT"
                offset={{ x: 0, y: 4 }} onClick={open} onMount={frame => frame.SetFrameStrata("MEDIUM")}
                decorations={{ background: new Background({ color: darkTheme.colors.background }),
                    border: new Border({ thickness: 1, color: darkTheme.colors.border }) }}>
                <Label text="L" align="CENTER" fontSize={16} color={darkTheme.colors.accent} />
            </Button>, undefined, minimap);
        listener.UnregisterAllEvents();
        listener.SetScript("OnEvent", undefined);
    };
    listener.RegisterEvent("ADDON_LOADED");
    listener.RegisterEvent("PLAYER_ENTERING_WORLD");
    listener.RegisterEvent("PLAYER_REGEN_ENABLED");
    listener.SetScript("OnEvent", attach);
    attach();
    return () => {
        listener.UnregisterAllEvents();
        listener.SetScript("OnEvent", undefined);
        if (launcher !== undefined) wuira.Unmount(launcher);
    };
}
