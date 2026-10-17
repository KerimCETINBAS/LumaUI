import { resolveUnit } from "wuira/datasources";
import type { UnitInput, UnitSource, ValueSource } from "wuira/datasources";

declare const UnitIsConnected: ((this: void, unit: string) => boolean | undefined) | undefined;

/** Builder adapter for connection-dependent visuals; unknown state never means offline. */
export class UnitConnection implements ValueSource<boolean | undefined> {
    private readonly target: UnitSource;
    private readonly listeners = new Set<(value: boolean | undefined) => void>();
    private frame?: wuiraNativeFrame;
    private stopUnit?: () => void;
    private previous?: boolean;
    private disposed = false;
    public constructor(unit: UnitInput, private readonly preview = false) { this.target = resolveUnit(unit); }
    public get Value(): boolean | undefined {
        if (this.preview) return true;
        const value = UnitIsConnected?.(this.target.Token);
        return issecretvalue(value) || typeof value !== "boolean" ? undefined : value;
    }
    public IsSecret(): boolean { return false; }
    public onChange(listener: (value: boolean | undefined) => void): () => void {
        if (this.disposed) throw "Connection source is disposed";
        this.listeners.add(listener);
        if (this.frame === undefined && !this.preview) {
            this.previous = this.Value;
            const frame = CreateFrame("Frame", undefined, UIParent); this.frame = frame;
            for (const event of ["UNIT_CONNECTION", "UNIT_PET", "GROUP_ROSTER_UPDATE", "PLAYER_ENTERING_WORLD"]) frame.RegisterEvent(event);
            frame.SetScript("OnEvent", (_frame, event, unit) => {
                if (event !== "UNIT_CONNECTION" || unit === this.target.Token) this.Refresh();
            });
            this.stopUnit = this.target.onChange(() => this.Refresh());
        }
        return () => { this.listeners.delete(listener); if (this.listeners.size === 0) this.Stop(); };
    }
    private Refresh(): void {
        const value = this.Value;
        if (value === this.previous) return;
        this.previous = value;
        for (const listener of this.listeners) listener(value);
    }
    private Stop(): void {
        this.stopUnit?.(); this.stopUnit = undefined;
        this.frame?.UnregisterAllEvents(); this.frame?.SetScript("OnEvent", undefined); this.frame?.Hide(); this.frame = undefined;
    }
    public Dispose(): void { this.disposed = true; this.Stop(); this.listeners.clear(); }
}
