import { UI } from "wuira";
import { ProgressSource, resolveUnit } from "wuira/datasources";
import type { UnitInput, UnitSource } from "wuira/datasources";
import type { CellProps } from "wuira/ui";

declare function UnitName(this: void, unit: string): wuiraNativeReturns<[string | undefined]>;
declare function UnitExists(this: void, unit: string): boolean;
declare function UnitGroupRolesAssigned(this: void, unit: string): string;
declare function UnitIsGroupLeader(this: void, unit: string): boolean;
declare function UnitPowerType(this: void, unit: string): wuiraNativeReturns<[number, string]>;
declare const PowerBarColor: Record<string, { r: number; g: number; b: number }>;

/** The currently displayed primary resource, rather than always mana. */
export class PrimaryPower extends ProgressSource {
    private readonly target: UnitSource;
    public constructor(unit: UnitInput) {
        const target = resolveUnit(unit);
        const type = () => { const [id] = UnitPowerType(target.Token); return id; };
        super({ current: () => UnitPower(target.Token, type()), min: () => 0, max: () => UnitPowerMax(target.Token, type()),
            percent: () => UnitPowerPercent(target.Token, type(), true, CurveConstants.ScaleTo100) });
        this.target = target;
    }
    protected Listen(_frame: wuiraNativeFrame, refresh: () => void): () => void {
        const listener = CreateFrame("Frame", undefined, UIParent);
        for (const event of ["UNIT_POWER_UPDATE", "UNIT_MAXPOWER", "UNIT_DISPLAYPOWER", "GROUP_ROSTER_UPDATE", "PLAYER_ENTERING_WORLD"]) listener.RegisterEvent(event);
        listener.SetScript("OnEvent", (_host, event, unit) => { if (!event.startsWith("UNIT_") || unit === this.target.Token) refresh(); });
        const stopUnit = this.target.onChange(refresh);
        return () => { stopUnit(); listener.UnregisterAllEvents(); listener.SetScript("OnEvent", undefined); listener.Hide(); };
    }
}

/** Native text sinks can display restricted health numbers without Lua arithmetic. */
export function unitText(props: Partial<CellProps>, input: UnitInput, field: string, preview: boolean, fontSize = 10, align = "LEFT") {
    const target = resolveUnit(input);
    return UI.createElement("cell", { ...props, onMount: (frame: wuiraNativeFrame) => {
        const label = frame.CreateFontString(undefined, "OVERLAY");
        label.SetAllPoints(frame); label.SetFont("Fonts\\FRIZQT__.TTF", fontSize, "OUTLINE");
        label.SetJustifyH(align as "LEFT" | "CENTER" | "RIGHT"); label.SetJustifyV("MIDDLE");
        const formatted = label as typeof label & { SetFormattedText(format: string, value: number): void };
        const refresh = () => {
            const unit = target.Token;
            if (preview && field !== "name") { label.SetText(field === "percent" ? "75%" : "1234"); return; }
            if (preview && UnitExists(unit) !== true) { label.SetText(field === "name" ? "Party member" : field === "percent" ? "75%" : "1234"); return; }
            if (field === "health") formatted.SetFormattedText("%d", UnitHealth(unit));
            else if (field === "percent") formatted.SetFormattedText("%.0f%%", UnitHealthPercent(unit, true, CurveConstants.ScaleTo100));
            else { const [name] = UnitName(unit); label.SetText(issecretvalue(name) ? name! : name ?? ""); }
        };
        for (const event of ["UNIT_NAME_UPDATE", "UNIT_HEALTH", "UNIT_MAXHEALTH", "UNIT_PET", "UNIT_CONNECTION", "GROUP_ROSTER_UPDATE", "PLAYER_ENTERING_WORLD"]) frame.RegisterEvent(event);
        frame.SetScript("OnEvent", (_host, event, changed) => { if (!event.startsWith("UNIT_") || event === "UNIT_PET" || changed === target.Token) refresh(); });
        const stopUnit = target.onChange(refresh);
        refresh();
        return () => { stopUnit(); frame.UnregisterAllEvents(); frame.SetScript("OnEvent", undefined); label.SetText(""); };
    } });
}

export function unitIndicator(props: Partial<CellProps>, input: UnitInput, field: string, preview: boolean) {
    const target = resolveUnit(input);
    return UI.createElement("cell", { ...props, onMount: (frame: wuiraNativeFrame) => {
        const texture = frame.CreateTexture(undefined, "OVERLAY"); texture.SetAllPoints(frame);
        const refresh = () => {
            const unit = target.Token;
            texture.Hide();
            if (field === "leader") {
                const leader = UnitIsGroupLeader(unit);
                if ((!issecretvalue(leader) && leader) || preview && unit === "player") { texture.SetTexture("Interface\\GroupFrame\\UI-Group-LeaderIcon"); texture.Show(); }
            } else {
                const role = UnitGroupRolesAssigned(unit);
                if (issecretvalue(role)) return;
                const uv = role === "TANK" ? [0, .25, .25, .5] : role === "HEALER" || preview ? [.75, 1, 0, .25] : role === "DAMAGER" ? [.25, .5, .25, .5] : undefined;
                if (uv !== undefined) { texture.SetTexture("Interface\\LFGFrame\\UI-LFG-ICON-PORTRAITROLES"); texture.SetTexCoord(uv[0], uv[1], uv[2], uv[3]); texture.Show(); }
            }
        };
        for (const event of ["GROUP_ROSTER_UPDATE", "PLAYER_ROLES_ASSIGNED", "PARTY_LEADER_CHANGED", "PLAYER_ENTERING_WORLD"]) frame.RegisterEvent(event);
        frame.SetScript("OnEvent", () => refresh()); const stopUnit = target.onChange(refresh); refresh();
        return () => { stopUnit(); frame.UnregisterAllEvents(); frame.SetScript("OnEvent", undefined); texture.Hide(); };
    } });
}

export function tintPrimaryPower(frame: wuiraNativeFrame, input: UnitInput): () => void {
    const target = resolveUnit(input);
    const refresh = () => {
        const [, token] = UnitPowerType(target.Token);
        const color = issecretvalue(token) ? undefined : PowerBarColor[token];
        (frame as wuiraNativeStatusBar).SetStatusBarColor(color?.r ?? .15, color?.g ?? .4, color?.b ?? .95, 1);
    };
    const listener = CreateFrame("Frame", undefined, UIParent);
    for (const event of ["UNIT_DISPLAYPOWER", "GROUP_ROSTER_UPDATE", "PLAYER_ENTERING_WORLD"]) listener.RegisterEvent(event);
    listener.SetScript("OnEvent", () => refresh()); const stopUnit = target.onChange(refresh); refresh();
    return () => { stopUnit(); listener.UnregisterAllEvents(); listener.SetScript("OnEvent", undefined); listener.Hide(); };
}
