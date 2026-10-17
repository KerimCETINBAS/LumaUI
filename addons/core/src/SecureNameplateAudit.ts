interface AuditPlate extends wuiraNativeFrame {
    readonly UnitFrame?: AuditPlate;
    readonly namePlateUnitToken?: string;
    GetUnit?(): string | undefined;
    GetAttribute?(name: string): unknown;
}
interface PlateAPI {
    GetNamePlates?(this: void): AuditPlate[];
    GetNamePlateForUnit?(this: void, unit: string): AuditPlate | undefined;
}
declare function UnitGUID(this: void, unit: string): string | undefined;

/** Read-only client evidence. No action buttons, native writes or secure API calls. */
export class SecureNameplateAudit {
    private listener?: wuiraNativeFrame;
    private readonly lines: string[] = [];
    private readonly frames = new Map<AuditPlate, number>();
    private readonly identities = new Map<AuditPlate, string>();
    private readonly tokens = new Map<string, string>();
    private combatCreated = 0;
    private combatAdded = 0;
    private recycled = 0;
    private retargeted = 0;
    private running = false;

    private api(): PlateAPI | undefined { return _G.C_NamePlate as PlateAPI | undefined; }
    private line(message: string): void {
        if (this.lines.length >= 96) this.lines.shift();
        this.lines.push((InCombatLockdown() ? "combat " : "out-of-combat ") + message);
    }
    private frameInfo(frame: AuditPlate | undefined): string {
        if (issecretvalue(frame)) return "secret-frame";
        if (frame === undefined) return "missing-frame";
        const forbidden = frame.IsForbidden?.();
        if (issecretvalue(forbidden) || forbidden === true) return "forbidden-frame";
        let id = this.frames.get(frame);
        if (id === undefined) { id = this.frames.size + 1; if (id > 512) return "frame-limit"; this.frames.set(frame, id); }
        const protectedFrame = frame.IsProtected?.();
        const attribute = frame.GetAttribute?.("unit");
        const unitAttribute = issecretvalue(attribute) ? "secret" : typeof attribute === "string" ? "public-string" : attribute === undefined ? "absent" : "other";
        return "frame#" + id + " protected=" + (issecretvalue(protectedFrame) ? "secret" : protectedFrame === true ? "yes" : "no") + " unit-attribute=" + unitAttribute;
    }
    private added(unit: unknown, snapshot = false): void {
        if (issecretvalue(unit) || typeof unit !== "string") { this.line("added restricted-unit"); return; }
        const frame = this.api()?.GetNamePlateForUnit?.(unit);
        const info = this.frameInfo(frame);
        const guid = UnitGUID(unit);
        let identity = "unavailable";
        if (issecretvalue(guid)) identity = "secret";
        else if (guid !== undefined && info.startsWith("frame#") && frame !== undefined) {
            identity = "public";
            const before = this.identities.get(frame), tokenBefore = this.tokens.get(unit);
            if (before !== undefined && before !== guid) this.recycled++;
            if (tokenBefore !== undefined && tokenBefore !== guid) this.retargeted++;
            this.identities.set(frame, guid); this.tokens.set(unit, guid);
        }
        if (!snapshot && InCombatLockdown()) this.combatAdded++;
        this.line((snapshot ? "snapshot " : "added ") + unit + " " + info + " identity=" + identity);
        if (info.startsWith("frame#") && frame !== undefined) this.line("visual " + this.frameInfo(frame.UnitFrame));
    }
    public Start(): void {
        if (this.running) { console.log("Secure nameplate audit is already running."); return; }
        this.lines.length = 0; this.frames.clear(); this.identities.clear(); this.tokens.clear();
        this.combatCreated = 0; this.combatAdded = 0; this.recycled = 0; this.retargeted = 0;
        this.running = true;
        this.listener = CreateFrame("Frame", undefined, UIParent);
        for (const event of ["NAME_PLATE_CREATED", "NAME_PLATE_UNIT_ADDED", "NAME_PLATE_UNIT_REMOVED", "PLAYER_REGEN_DISABLED", "PLAYER_REGEN_ENABLED"]) this.listener.RegisterEvent(event);
        this.listener.SetScript<[unknown]>("OnEvent", (_frame, event, payload) => {
            try {
                if (event === "NAME_PLATE_CREATED") {
                    if (InCombatLockdown()) this.combatCreated++;
                    this.line("created " + this.frameInfo(payload as AuditPlate));
                } else if (event === "NAME_PLATE_UNIT_ADDED") this.added(payload);
                else if (event === "NAME_PLATE_UNIT_REMOVED") this.line("removed " + (issecretvalue(payload) || typeof payload !== "string" ? "restricted-unit" : payload));
                else this.line(event);
            } catch { this.line("unavailable native read (no data recorded)"); }
        });
        for (const frame of this.api()?.GetNamePlates?.() ?? []) {
            try {
                if (this.frameInfo(frame).startsWith("frame#")) {
                    const nativeUnit = frame.GetUnit?.();
                    if (!issecretvalue(nativeUnit)) this.added(nativeUnit ?? frame.namePlateUnitToken, true);
                }
            } catch { this.line("unavailable snapshot read"); }
        }
        console.log("Secure nameplate audit started. Read-only: no casting or frame changes. Use /luma secureplates report after combat.");
    }
    public Report(): string[] {
        const capabilities = ["SecureHandlerSetFrameRef", "SecureHandlerWrapScript", "RegisterStateDriver"].map(name => name + "=" + (typeof _G[name] === "function" ? "present" : "missing"));
        return ["Secure nameplate combat actions: UNVERIFIED (API presence is not support)",
            "audit=" + (this.running ? "running" : "stopped") + " combat-created=" + this.combatCreated + " combat-added=" + this.combatAdded + " frame-reuse=" + this.recycled + " token-reuse=" + this.retargeted,
            ...capabilities, ...this.lines.slice(-24)];
    }
    public Stop(): void {
        this.listener?.UnregisterAllEvents(); this.listener?.SetScript("OnEvent", undefined);
        this.listener = undefined; this.running = false;
    }
    public Command(action = "report"): void {
        if (action === "start") this.Start();
        else if (action === "stop") { this.Stop(); console.log("Secure nameplate audit stopped."); }
        else if (action === "report") for (const line of this.Report()) console.log(line);
        else console.log("Usage: /luma secureplates start | report | stop");
    }
}
