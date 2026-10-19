import type { EditModeLayouts } from "wuira/datasources";
import type { CollectionCondition, PresetDocument } from "../../core/builder";
import { fail } from "../validate";

declare const UnitClass: ((this: void, unit: string) => wuiraNativeReturns<[string | undefined, string | undefined, number | undefined]>) | undefined;
declare const IsInRaid: ((this: void) => boolean) | undefined;
declare const GetNumGroupMembers: ((this: void) => number) | undefined;

export const activationModes = ["condMet", "always", "never"] as const;
export const collectionConditions = ["inParty", "inRaid", "inGroup", "solo"] as const;
export const collectionClasses = ["WARRIOR", "PALADIN", "HUNTER", "ROGUE", "PRIEST", "SHAMAN", "MAGE", "WARLOCK", "DRUID"] as const;

export function validateActivation(document: Record<string, unknown>): void {
    if (document.layout !== undefined && (typeof document.layout !== "string" || document.layout.length === 0 || document.layout.length > 256)) fail("invalid native layout key");
    if (document.layoutPositions !== undefined) {
        if (typeof document.layoutPositions !== "object" || document.layoutPositions === null || Array.isArray(document.layoutPositions)) fail("invalid layout positions");
        const entries = Object.entries(document.layoutPositions);
        if (entries.length > 64) fail("too many layout positions");
        for (const [key, value] of entries) {
            if (key.length === 0 || key.length > 256 || typeof value !== "object" || value === null || Array.isArray(value)) fail("invalid layout position");
            const point = value as Record<string, unknown>;
            if (Object.keys(point).some(key => key !== "x" && key !== "y") || typeof point.x !== "number" || typeof point.y !== "number" || !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 100000 || Math.abs(point.y) > 100000) fail("invalid layout coordinates");
        }
    }
    if (document.enabled !== undefined && !activationModes.includes(document.enabled as never)) fail("invalid component activation mode");
    if (document.class !== undefined && !collectionClasses.includes(document.class as never)) fail("invalid component class");
    if (document.condition !== undefined && !collectionConditions.includes(document.condition as never)) fail("invalid component condition");
}

/** One lazy context per event: disabled collections never read game state. */
export class ActivationContext {
    private classRead = false;
    private playerClass?: string;
    private groupRead = false;
    private raid = false;
    private groupCount = 0;
    private groupAvailable = false;

    public constructor(private readonly layouts?: EditModeLayouts) {}
    public get LayoutKey(): string | undefined { return this.layouts?.Status === "ready" ? this.layouts.Active?.key : undefined; }

    public Matches(document: PresetDocument): boolean {
        if (document.enabled === "never") return false;
        if (document.enabled === "always") return true;
        if (document.class !== undefined) {
            if (!this.classRead) {
                this.classRead = true;
                if (UnitClass !== undefined) {
                    const [, token] = UnitClass("player");
                    if (!issecretvalue(token)) this.playerClass = token;
                }
            }
            if (document.class !== this.playerClass) return false;
        }
        return (document.layout === undefined || document.layout === this.LayoutKey)
            && (document.condition === undefined || this.Condition(document.condition));
    }

    private Condition(condition: CollectionCondition): boolean {
        if (!this.groupRead) {
            this.groupRead = true;
            if (IsInRaid !== undefined && GetNumGroupMembers !== undefined) {
                const raid = IsInRaid(), count = GetNumGroupMembers();
                if (!issecretvalue(raid) && !issecretvalue(count) && typeof raid === "boolean" && Number.isInteger(count) && count >= 0 && count <= 1024) {
                    this.raid = raid; this.groupCount = count; this.groupAvailable = true;
                }
            }
        }
        if (!this.groupAvailable) return false;
        if (condition === "inRaid") return this.raid;
        if (condition === "inGroup") return this.groupCount > 0;
        if (condition === "inParty") return !this.raid && this.groupCount > 0;
        return !this.raid && this.groupCount === 0;
    }
}
