import { UI } from "wuira/ui";
import { DataSource, ProgressSource, resolveUnit } from "wuira/datasources";
import type { UnitInput, UnitSource } from "wuira/datasources";
import type { CellProps } from "wuira/ui";
import type { SourceInstance } from "../../core/builder";

declare function UnitName(this: void, unit: string): wuiraNativeReturns<[string | undefined, string | undefined]>;
declare function UnitIsPlayer(this: void, unit: string): boolean;
declare const Constants: { CharacterNameSeparatorConsts?: { CHARACTERNAME_SURNAME_SEPARATOR?: string } } | undefined;
declare function UnitExists(this: void, unit: string): boolean;
declare function UnitGroupRolesAssigned(this: void, unit: string): string;
declare function UnitIsGroupLeader(this: void, unit: string): boolean;
declare function UnitPowerType(this: void, unit: string): wuiraNativeReturns<[number, string]>;
declare const PowerBarColor: Record<string, { r: number; g: number; b: number }>;

export interface ResourceColor { readonly r: number; readonly g: number; readonly b: number; readonly a: number }

function readResourceColor(token: string | undefined): ResourceColor {
    const color = token !== undefined && token !== "" && !issecretvalue(token) ? PowerBarColor[token] : undefined;
    return { r: color?.r ?? .15, g: color?.g ?? .4, b: color?.b ?? .95, a: 1 };
}

/** RGBA for a power token. Primary reads UnitPowerType; mana is always MANA. */
export class ResourceColorSource extends DataSource<ResourceColor> {
    private readonly listeners = new Set<(value: ResourceColor) => void>();
    private events?: wuiraNativeFrame;
    private stopUnit?: () => void;
    public constructor(private readonly target: UnitSource, private readonly token: () => string | undefined) { super(readResourceColor(undefined)); }
    protected override GetValue(): ResourceColor {
        const token = this.token();
        return readResourceColor(issecretvalue(token) ? undefined : token);
    }
    public onChange(listener: (value: ResourceColor) => void): () => void {
        this.listeners.add(listener);
        if (this.listeners.size === 1) {
            const refresh = () => { const value = this.GetValue(); if (this.CanEmit(value)) for (const callback of this.listeners) callback(value); };
            const events = CreateFrame("Frame", undefined, UIParent); this.events = events;
            for (const event of ["UNIT_DISPLAYPOWER", "GROUP_ROSTER_UPDATE", "PLAYER_ENTERING_WORLD"]) events.RegisterEvent(event);
            events.SetScript("OnEvent", (_frame, event, unit) => { if (event !== "UNIT_DISPLAYPOWER" || !issecretvalue(unit) && unit === this.target.Token) refresh(); });
            this.stopUnit = this.target.onChange(refresh);
        }
        return () => { this.listeners.delete(listener); if (this.listeners.size === 0) this.Stop(); };
    }
    private Stop(): void {
        this.stopUnit?.(); this.stopUnit = undefined;
        this.events?.UnregisterAllEvents(); this.events?.SetScript("OnEvent", undefined); this.events?.Hide(); this.events = undefined;
    }
    public Dispose(): void { this.Stop(); this.listeners.clear(); }
}

export function primaryResourceColor(target: UnitSource): ResourceColorSource {
    return new ResourceColorSource(target, () => { const [, token] = UnitPowerType(target.Token); return token; });
}
export function manaResourceColor(target: UnitSource): ResourceColorSource {
    return new ResourceColorSource(target, () => "MANA");
}

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

function nameSeparator(): string {
    const separator = Constants?.CharacterNameSeparatorConsts?.CHARACTERNAME_SURNAME_SEPARATOR;
    return separator !== undefined && separator !== "" ? separator : " ";
}

/** Forever's UnitName returns the forename and, for a player character, the surname. */
function unitNames(token: string): { name: string; surname: string } {
    const [first, last] = UnitName(token);
    const name = issecretvalue(first) || first === undefined ? "" : first;
    const player = UnitIsPlayer(token);
    if (issecretvalue(player) || player !== true || last === undefined || last === "" || issecretvalue(last)) return { name, surname: "" };
    return { name, surname: last };
}

/** FullName is derived. It is the forename joined with the surname, and empty when either part is missing. */
function fullName(name: string, surname: string): string {
    if (name === "" || surname === "") return "";
    const tail = nameSeparator() + surname;
    return name.slice(-tail.length) === tail ? name : name + tail;
}

/** Name and health text for a unit, including one passed into a component as an input. */
export function unitTextChannels(token: string, preview: boolean, props?: { text?: unknown; initial?: unknown; maximum?: unknown }): SourceInstance["channels"] {
    if (preview) {
        const name = typeof props?.text === "string" && props.text !== "" ? props.text : "Sample";
        const surname = "Surname";
        const current = typeof props?.initial === "number" ? props.initial : 75;
        const maximum = typeof props?.maximum === "number" && props.maximum > 0 ? props.maximum : 100;
        return { name: { Text: () => name }, surname: { Text: () => surname }, fullName: { Text: () => fullName(name, surname) }, health: { Text: () => String(current) }, percent: { Text: () => Math.floor(current / maximum * 100) + "%" }, role: { Text: () => "HEALER" }, leader: { Text: () => "Leader" }, isLeader: { IsActive: () => true } };
    }
    return {
        name: { Text: () => unitNames(token).name },
        surname: { Text: () => unitNames(token).surname },
        fullName: { Text: () => { const parts = unitNames(token); return fullName(parts.name, parts.surname); } },
        health: { Text: () => String(UnitHealth(token)) },
        percent: { Text: () => String(Math.floor(UnitHealthPercent(token, true, CurveConstants.ScaleTo100))) + "%" },
        role: { Text: () => UnitGroupRolesAssigned(token) },
        leader: { Text: () => UnitIsGroupLeader(token) ? "Leader" : "" },
        isLeader: { IsActive: () => { const leader = UnitIsGroupLeader(token); return !issecretvalue(leader) && leader === true; } },
    };
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
