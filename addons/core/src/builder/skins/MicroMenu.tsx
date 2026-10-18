import { UI, HoverTracker } from "wuira/ui";
import { wuira } from "wuira";
import { MicroBar } from "wuira/skins";
import { Cell, FlowLayout, Background, Border } from "wuira/ui";
import { darkTheme } from "../../theme/dark";

/** LumaUI's compact menu presentation; wuira only supplies native adapters and hover tracking. */
export function createMicroMenu(): () => void {
    const bar = new MicroBar();
    let stopPresentation: (() => void) | undefined;
    bar.render(bar => {
        const menu = bar.Frame!;
        const colors = darkTheme.colors;
        const padding = darkTheme.spacing.panelPadding;
        bar.Style({
            background: colors.background, border: colors.border,
            buttonBackground: colors.surface, icon: colors.text,
            disabledIcon: colors.muted, accent: colors.accent, padding,
        });
        const parent = menu.GetParent();
        const [point, relative, relativePoint, x, y] = menu.GetPoint(1);
        const hover = new HoverTracker({ regions: [menu], hideDelay: 0.25 });
        hover.Trigger.SetSize(32, 32);
        hover.Trigger.SetPoint("BOTTOMRIGHT", UIParent, "BOTTOMRIGHT", -12, 12);
        hover.Trigger.SetFrameStrata("MEDIUM");
        hover.Popup.SetFrameStrata("DIALOG");
        hover.Popup.SetPoint("BOTTOMRIGHT", hover.Trigger, "TOPRIGHT", 0, 4);
        const launcher = wuira.Mount(() => (
            <Cell width={32} height={32} anchor="TOPLEFT" mode="relative" offset={{ x: 0, y: 0 }}
                decorations={{ background: new Background({ color: colors.background }),
                    border: new Border({ color: colors.border, thickness: 1 }) }}>
                <FlowLayout width={12} height={9} direction="vertical" gap={3}
                    anchor="CENTER" relativeAnchor="CENTER" mode="relative" offset={{ x: 0, y: 0 }}>
                    <Cell width="inherit" height={1} decorations={{ background: new Background({ color: colors.text }) }} />
                    <Cell width="inherit" height={1} decorations={{ background: new Background({ color: colors.accent }) }} />
                    <Cell width="inherit" height={1} decorations={{ background: new Background({ color: colors.text }) }} />
                </FlowLayout>
            </Cell>
        ), undefined, hover.Trigger);
        bar.OnHover(hovered => hover.Trigger.SetAlpha(hovered ? 1 : 0.9));
        let enabled = true;
        let disposed = false;
        const listener = CreateFrame("Frame", undefined, UIParent);
        const sync = () => {
            if (disposed || InCombatLockdown()) return;
            if (!enabled) {
                if (menu.GetParent() === hover.Popup) {
                    menu.SetParent(parent);
                    menu.ClearAllPoints();
                    menu.SetPoint(point, relative, relativePoint, x, y);
                }
                if (launcher !== undefined) wuira.Unmount(launcher);
                hover.Dispose();
                bar.Dispose();
                listener.UnregisterAllEvents();
                listener.SetScript("OnEvent", undefined);
                disposed = true;
                return;
            }
            const currentParent = menu.GetParent();
            if (currentParent !== parent && currentParent !== hover.Popup) {
                hover.Trigger.Hide();
                hover.Popup.Hide();
                return;
            }
            hover.Popup.SetSize(menu.GetWidth() * menu.GetScale() + padding * 2, menu.GetHeight() * menu.GetScale() + padding * 2);
            if (currentParent !== hover.Popup) {
                menu.SetParent(hover.Popup);
                menu.ClearAllPoints();
                menu.SetPoint("BOTTOMRIGHT", hover.Popup, "BOTTOMRIGHT", -padding, padding);
            }
            hover.Trigger.Show();
        };
        menu.HookScript("OnSizeChanged", () => sync());
        hooksecurefunc(menu, "ResetMicroMenuPosition", () => sync());
        listener.RegisterEvent("PLAYER_REGEN_ENABLED");
        listener.RegisterEvent("PLAYER_ENTERING_WORLD");
        listener.SetScript("OnEvent", () => sync());
        sync();
        stopPresentation = () => { enabled = false; sync(); };
        return bar;
    });
    return () => {
        if (stopPresentation !== undefined) stopPresentation();
        else bar.Dispose();
    };
}
