/// <reference types="@typescript-to-lua/language-extensions" />
import { Store } from "wuira/store";
import { FrameMover } from "wuira/ui";
import type { FramePosition } from "wuira/ui";
import type { EditModeLayouts } from "wuira/datasources";
import type { EditMode, LumaCoreAPI, LumaModule } from "./core/contract";

interface NativeFrame extends wuiraNativeFrame {
    IsVisible?(): boolean; IsForbidden?(): boolean; GetEffectiveScale?(): number;
}
interface EditManager extends NativeFrame {
    registeredSystemFrames?: NativeFrame[];
    IsEditModeActive?(): boolean;
    EnterEditMode?(): void; ExitEditMode?(): void;
}
declare const hooksecurefunc: ((this: void, object: object, method: string, callback: (this: void) => void) => void) | undefined;
type Anchor = { point: wuiraAnchor; relative: wuiraNativeFrame; relativePoint: wuiraAnchor; x: number; y: number };
class NativePositions extends Store {
    public static readonly Token = "lumaui.native-frame-positions";
    public layouts: Record<string, Record<string, FramePosition>> = {};
}
const fallback = ["PlayerFrame", "TargetFrame", "FocusFrame", "PetFrame", "PartyFrame", "CompactRaidFrameContainer",
    "MinimapCluster", "ObjectiveTrackerFrame", "PlayerCastingBarFrame", "BuffFrame", "DebuffFrame",
    "MainActionBar", "MainMenuBar", "MultiBarBottomLeft", "MultiBarBottomRight", "MultiBarRight", "MultiBarLeft",
    "MultiBar5", "MultiBar6", "MultiBar7", "StanceBar", "PetActionBar", "MicroMenu", "BagsBar",
    ...Array.from({ length: 10 }, (_, index) => "ChatFrame" + (index + 1))];
const labels: Readonly<Record<string, string>> = {
    PlayerFrame: "Player", TargetFrame: "Target", FocusFrame: "Focus", PetFrame: "Pet", PartyFrame: "Party",
    CompactRaidFrameContainer: "Raid", MinimapCluster: "Minimap", ObjectiveTrackerFrame: "Quest tracker",
    PlayerCastingBarFrame: "Cast bar", BuffFrame: "Buffs", DebuffFrame: "Debuffs", MicroMenu: "Micro menu",
};
function ratio(frame: NativeFrame): number {
    return (frame.GetEffectiveScale?.() ?? frame.GetScale()) / ((UIParent as NativeFrame).GetEffectiveScale?.() ?? UIParent.GetScale());
}
/** Adapt native scale to the UIParent coordinates used by the shared wuira mover. */
class MoveTarget {
    public constructor(private readonly frame: NativeFrame) {}
    public GetWidth(): number { return this.frame.GetWidth() * ratio(this.frame); }
    public GetHeight(): number { return this.frame.GetHeight() * ratio(this.frame); }
    public GetCenter(): LuaMultiReturn<[number | undefined, number | undefined]> {
        const [x, y] = this.frame.GetCenter(), scale = ratio(this.frame);
        return $multi(x === undefined ? undefined : x * scale, y === undefined ? undefined : y * scale);
    }
    public ClearAllPoints(): void { this.frame.ClearAllPoints(); }
    public SetPoint(point: wuiraAnchor, parent: wuiraNativeFrame, relative: wuiraAnchor, x: number, y: number): void {
        const scale = ratio(this.frame); this.frame.SetPoint(point, parent, relative, x / scale, y / scale);
    }
}
interface Entry { frame: NativeFrame; original?: Anchor[]; applied?: FramePosition; }

/** Native-frame editing policy and layout persistence; wuira owns the drag handles. */
export class NativeFrameControls implements LumaModule {
    private mode: EditMode = "locked";
    private key: string;
    private readonly entries = new Map<string, Entry>();
    private readonly movers = new Map<string, FrameMover>();
    private readonly hooked = new Set<NativeFrame>();
    private readonly managers = new Set<EditManager>();
    private readonly listener = CreateFrame("Frame", undefined, UIParent);
    private queued = false;
    private applying = false;
    private dragging = false;
    private disposed = false;
    private readonly stopLayouts: () => void;
    public constructor(private readonly core: LumaCoreAPI, private readonly layouts: EditModeLayouts) {
        this.key = this.LayoutKey();
        for (const event of ["PLAYER_ENTERING_WORLD", "ADDON_LOADED", "PLAYER_REGEN_ENABLED", "UI_SCALE_CHANGED", "DISPLAY_SIZE_CHANGED"]) this.listener.RegisterEvent(event);
        this.listener.SetScript("OnEvent", () => this.Queue());
        this.listener.Hide();
        this.stopLayouts = layouts.onChange(() => this.Queue());
        this.Refresh();
    }
    private LayoutKey(): string { return this.layouts.Status === "ready" ? this.layouts.Active?.key ?? "default" : "default"; }
    private Manager(): EditManager | undefined { return _G.EditModeManagerFrame as EditManager | undefined; }
    private Position(id: string): FramePosition | undefined {
        const value = this.core.Store.get(NativePositions).layouts[this.key]?.[id];
        return value !== undefined && Number.isFinite(value.x) && Number.isFinite(value.y) ? value : undefined;
    }
    private Queue(): void {
        if (this.disposed || this.applying || this.queued) return;
        this.queued = true;
        if (InCombatLockdown()) { this.queued = false; return; }
        this.listener.Show();
        this.listener.SetScript("OnUpdate", () => {
            this.listener.SetScript("OnUpdate", undefined); this.listener.Hide(); this.queued = false;
            if (!InCombatLockdown() && !this.dragging) this.Refresh();
        });
    }
    private Capture(frame: NativeFrame): Anchor[] | undefined {
        if (frame.GetNumPoints === undefined || frame.GetPoint === undefined) return undefined;
        const points: Anchor[] = [];
        for (let index = 1; index <= frame.GetNumPoints(); index++) {
            const [point, relative, relativePoint, x, y] = frame.GetPoint(index);
            points.push({ point, relative: relative ?? UIParent, relativePoint, x, y });
        }
        return points.length === 0 ? undefined : points;
    }
    private Owns(entry: Entry): boolean {
        if (entry.applied === undefined) return false;
        const [x, y] = entry.frame.GetCenter(), [sx, sy] = UIParent.GetCenter(), scale = ratio(entry.frame);
        return x !== undefined && y !== undefined && sx !== undefined && sy !== undefined
            && Math.abs(x * scale - sx - entry.applied.x) < 1 && Math.abs(sy - y * scale - entry.applied.y) < 1;
    }
    private Restore(entry: Entry): void {
        if (entry.original !== undefined && this.Owns(entry)) {
            entry.frame.ClearAllPoints();
            for (const anchor of entry.original) entry.frame.SetPoint(anchor.point, anchor.relative, anchor.relativePoint, anchor.x, anchor.y);
        }
        entry.original = undefined; entry.applied = undefined;
    }
    private Discover(): void {
        const manager = this.Manager(), candidates = [...manager?.registeredSystemFrames ?? []];
        for (const name of fallback) {
            const frame = _G[name] as NativeFrame | undefined;
            if (frame !== undefined && !candidates.includes(frame)) candidates.push(frame);
        }
        for (const frame of candidates) {
            if (frame === UIParent || frame.GetName === undefined || frame.IsForbidden?.()) continue;
            const id = frame.GetName();
            if (id === undefined || id.startsWith("Luma") || frame.GetCenter === undefined) continue;
            if (this.entries.get(id)?.frame !== frame) this.entries.set(id, { frame });
            if (this.hooked.has(frame)) continue;
            this.hooked.add(frame);
            frame.HookScript("OnShow", () => this.Queue());
            frame.HookScript("OnHide", () => this.Queue());
            if (hooksecurefunc !== undefined) hooksecurefunc(frame, "SetPoint", () => {
                if (!this.applying && this.Position(id) !== undefined) this.Queue();
            });
        }
        if (manager !== undefined && !this.managers.has(manager) && hooksecurefunc !== undefined) {
            this.managers.add(manager);
            for (const method of ["EnterEditMode", "ExitEditMode"]) if (typeof (manager as unknown as Record<string, unknown>)[method] === "function") hooksecurefunc(manager, method, () => this.Queue());
        }
    }
    private ClearMovers(): void {
        const previous = Array.from(this.movers.values()); this.movers.clear();
        for (const mover of previous) mover.Dispose();
        this.dragging = false;
    }
    private Refresh(): void {
        if (InCombatLockdown()) return;
        this.ClearMovers(); this.Discover();
        this.applying = true;
        try {
            const key = this.LayoutKey(), nativeEditing = this.Manager()?.IsEditModeActive?.() === true;
            if (key !== this.key || nativeEditing) {
                for (const entry of this.entries.values()) this.Restore(entry);
                this.key = key;
            }
            for (const [id, entry] of this.entries) {
                const frame = entry.frame, position = this.Position(id);
                if (nativeEditing) continue;
                if (position !== undefined) {
                    if (!this.Owns(entry)) entry.original = this.Capture(frame);
                    const target = new MoveTarget(frame);
                    target.ClearAllPoints(); target.SetPoint("CENTER", UIParent, "CENTER", position.x, -position.y);
                    entry.applied = position;
                }
                if (this.mode !== "unlock" || !(frame.IsVisible?.() ?? frame.IsShown()) || frame.GetWidth() <= 0 || frame.GetHeight() <= 0) continue;
                // A registered root already moves its children; avoid overlapping handles.
                let parent = frame.GetParent(), nested = false;
                for (let depth = 0; depth < 20 && parent !== undefined && parent !== UIParent; depth++) {
                    if (Array.from(this.entries.values()).some(other => other.frame === parent)) { nested = true; break; }
                    parent = parent.GetParent();
                }
                if (nested) continue;
                if (entry.original === undefined) entry.original = this.Capture(frame);
                const layoutKey = this.key;
                const mover = new FrameMover(new MoveTarget(frame) as unknown as wuiraNativeFrame, {
                    label: "Native · " + (labels[id] ?? id),
                    onMove: value => {
                        const position = { x: Math.round(value.x), y: Math.round(value.y) };
                        entry.applied = position;
                        this.core.Store.set(NativePositions, state => {
                            state.layouts = { ...state.layouts, [layoutKey]: { ...state.layouts[layoutKey], [id]: position } };
                            return state;
                        });
                        this.dragging = false; this.Queue();
                    },
                });
                const handle = mover.Frame as wuiraNativeFrame & { HookScript(script: "OnDragStart", callback: (this: void) => void): void };
                handle.HookScript("OnDragStart", () => { this.dragging = true; });
                this.movers.set(id, mover);
            }
        } finally { this.applying = false; }
    }
    public SetMode(mode: EditMode): void {
        this.mode = mode;
        if (InCombatLockdown()) {
            this.ClearMovers(); this.listener.SetScript("OnUpdate", undefined); this.listener.Hide(); this.queued = false; return;
        }
        this.Refresh();
    }
    public Dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.ClearMovers(); this.stopLayouts();
        this.listener.UnregisterAllEvents(); this.listener.SetScript("OnEvent", undefined);
        this.listener.SetScript("OnUpdate", undefined); this.listener.Hide(); this.queued = false;
    }
    public Reset(): void {
        if (InCombatLockdown()) return;
        this.mode = "locked"; this.ClearMovers(); this.applying = true;
        try {
            this.core.Store.set(NativePositions, () => new NativePositions());
            for (const entry of this.entries.values()) this.Restore(entry);
        } finally { this.applying = false; }
    }
}
