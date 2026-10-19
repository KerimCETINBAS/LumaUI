import { darkTheme } from "../theme/dark";
import { IconTextures } from "../theme/icons";

interface MinimapButton extends wuiraNativeFrame {
    GetEffectiveScale?(): number;
    SetHighlightTexture?(texture: string): void;
    dataObject?: Broker;
    db?: { minimapPos: number; hide?: boolean };
    HookScript(script: "OnDragStop" | "OnEnter" | "OnLeave" | "OnShow" | "OnHide" | "OnSizeChanged", callback: (this: void, frame: wuiraNativeFrame) => void): void;
}
interface LauncherTooltip {
    SetOwner(frame: wuiraNativeFrame, anchor: string): void;
    SetText(text: string): void;
    AddLine(text: string, r: number, g: number, b: number): void;
    Show(): void;
    Hide(): void;
}
interface Broker {
    type: "launcher"; label: string; icon: string;
    OnClick(this: void): void;
    OnTooltipShow(this: void, tooltip: LauncherTooltip): void;
}
interface DBIcon {
    Register(name: string, broker: Broker, db: { minimapPos: number; hide: boolean }): void;
    GetMinimapButton(name: string): MinimapButton | undefined;
    Refresh(name: string, db: { minimapPos: number; hide: boolean }): void;
    Hide(name: string): void;
}
declare function CreateFrame(this: void, kind: "Button", name: string, parent: wuiraNativeFrame): MinimapButton;
declare function CreateFrame(this: void, kind: "Frame", name: undefined, parent: wuiraNativeFrame): wuiraNativeFrame;
declare function GetCursorPosition(this: void): wuiraNativeReturns<[number, number]>;
declare const GetMinimapShape: ((this: void) => string) | undefined;

function readable(value: number | undefined): value is number {
    return !issecretvalue(value) && typeof value === "number" && Number.isFinite(value);
}

/** Standard minimap-edge launcher; prefer the shared icon registry when available. */
export function installMinimapLauncher(open: () => void, readPosition: () => number = () => 225,
    savePosition: (angle: number) => void = () => {}): () => void {
    const listener = CreateFrame("Frame", undefined, UIParent);
    let disposed = false;
    let button: MinimapButton | undefined;
    let registry: DBIcon | undefined;
    let angle = readPosition();
    if (!readable(angle)) angle = 225;
    angle = ((angle % 360) + 360) % 360;
    const broker: Broker = {
        type: "launcher", label: "LumaUI", icon: IconTextures.settings,
        OnClick: () => { if (!disposed) open(); },
        OnTooltipShow: tooltip => {
            tooltip.SetText("LumaUI");
            tooltip.AddLine("Click to open LumaUI", 1, 1, 1);
            tooltip.AddLine("Drag around the minimap to move", 0.7, 0.7, 0.7);
        },
    };
    const persist = (position: number) => {
        if (disposed || !readable(position)) return;
        angle = ((position % 360) + 360) % 360;
        savePosition(angle);
    };
    const attach = () => {
        if (disposed || button !== undefined || InCombatLockdown()) return;
        const minimap = _G.Minimap as MinimapButton | undefined;
        if (minimap === undefined || minimap.IsForbidden?.() === true) return;
        const stub = _G.LibStub as { GetLibrary(name: string, silent: boolean): DBIcon | undefined } | undefined;
        registry = stub?.GetLibrary("LibDBIcon-1.0", true);
        if (registry !== undefined) {
            const db = { minimapPos: angle, hide: false };
            button = registry.GetMinimapButton("LumaUI");
            if (button === undefined) { registry.Register("LumaUI", broker, db); button = registry.GetMinimapButton("LumaUI"); }
            else { button.dataObject = broker; registry.Refresh("LumaUI", db); }
            button?.HookScript("OnDragStop", () => persist(db.minimapPos));
        } else {
            // Work without another addon's libraries, using the game's circular icon artwork.
            button = CreateFrame("Button", "LumaUIMinimapButton", minimap);
            const frame = button;
            frame.SetSize(31, 31);
            frame.SetFrameStrata("MEDIUM");
            frame.SetFrameLevel(minimap.GetFrameLevel() + 8);
            frame.EnableMouse(true);
            frame.RegisterForDrag("LeftButton");
            frame.SetHighlightTexture?.("Interface\\Minimap\\UI-Minimap-ZoomButton-Highlight");
            const background = frame.CreateTexture(undefined, "BACKGROUND");
            background.SetSize(20, 20);
            background.SetTexture("Interface\\Minimap\\UI-Minimap-Background");
            background.SetPoint("TOPLEFT", frame, "TOPLEFT", 7, -5);
            const border = frame.CreateTexture(undefined, "OVERLAY");
            border.SetSize(53, 53);
            border.SetTexture("Interface\\Minimap\\MiniMap-TrackingBorder");
            border.SetPoint("TOPLEFT", frame, "TOPLEFT", 0, 0);
            const label = frame.CreateFontString(undefined, "OVERLAY");
            label.SetAllPoints(frame); label.SetFont("Fonts\\FRIZQT__.TTF", 14, "OUTLINE");
            label.SetJustifyH("CENTER"); label.SetJustifyV("MIDDLE"); label.SetText("L");
            const color = darkTheme.colors.accent;
            label.SetTextColor(color.r, color.g, color.b, color.a);
            const position = () => {
                if (disposed) return;
                const radians = angle * Math.PI / 180;
                let x = Math.cos(radians), y = Math.sin(radians);
                if (GetMinimapShape?.() === "SQUARE") { const factor = Math.max(Math.abs(x), Math.abs(y)); x /= factor; y /= factor; }
                frame.ClearAllPoints();
                frame.SetPoint("CENTER", minimap, "CENTER", x * (minimap.GetWidth() / 2 + 5), y * (minimap.GetHeight() / 2 + 5));
            };
            const move = () => {
                const [cx, cy] = GetCursorPosition(), [mx, my] = minimap.GetCenter();
                const scale = minimap.GetEffectiveScale?.() ?? minimap.GetScale();
                if (!readable(cx) || !readable(cy) || !readable(mx) || !readable(my) || !readable(scale) || scale <= 0) return;
                const x = cx / scale - mx, y = cy / scale - my;
                if (x === 0 && y === 0) return;
                angle = Math.atan2(y, x) * 180 / Math.PI;
                position();
            };
            frame.SetScript("OnClick", () => broker.OnClick());
            frame.SetScript("OnDragStart", () => { move(); frame.SetScript("OnUpdate", move); });
            frame.SetScript("OnDragStop", () => { frame.SetScript("OnUpdate", undefined); persist(angle); });
            frame.SetScript("OnEnter", () => {
                const tooltip = _G.GameTooltip as LauncherTooltip | undefined;
                if (tooltip === undefined) return;
                tooltip.SetOwner(frame, "ANCHOR_LEFT"); broker.OnTooltipShow(tooltip); tooltip.Show();
            });
            frame.SetScript("OnLeave", () => { (_G.GameTooltip as LauncherTooltip | undefined)?.Hide(); });
            frame.HookScript("OnHide", () => { frame.SetScript("OnUpdate", undefined); if (!disposed) (_G.GameTooltip as LauncherTooltip | undefined)?.Hide(); });
            minimap.HookScript("OnSizeChanged", position);
            minimap.HookScript("OnShow", position);
            position(); frame.Show();
        }
        if (button === undefined) return;
        listener.UnregisterAllEvents(); listener.SetScript("OnEvent", undefined);
    };
    for (const event of ["ADDON_LOADED", "PLAYER_ENTERING_WORLD", "PLAYER_REGEN_ENABLED"]) listener.RegisterEvent(event);
    listener.SetScript("OnEvent", attach); attach();
    return () => {
        if (disposed) return;
        disposed = true;
        listener.UnregisterAllEvents(); listener.SetScript("OnEvent", undefined);
        if (registry !== undefined) registry.Hide("LumaUI");
        else if (button !== undefined) {
            for (const script of ["OnClick", "OnDragStart", "OnDragStop", "OnEnter", "OnLeave", "OnHide", "OnUpdate"])
                button.SetScript(script as "OnClick", undefined);
            button.Hide();
        }
    };
}
