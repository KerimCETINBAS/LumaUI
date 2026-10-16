import { GroupRoster as NativeGroupRoster } from "wuira/datasources";
import type { GroupScope, GroupRosterMember } from "wuira/datasources";
export { getPetUnitToken as petUnit } from "wuira/datasources";

/** Luma-specific authoring samples; native roster and identity reads belong to wuira. */
export class GroupRoster {
    private readonly source?: NativeGroupRoster;
    public constructor(scope: GroupScope, private readonly pets: boolean, manual: boolean, preview: boolean) {
        if (!preview) this.source = new NativeGroupRoster(scope, { pets, includeSelfWhenSolo: manual });
    }
    public get Value(): readonly GroupRosterMember[] {
        if (this.source !== undefined) return this.source.Value;
        return ["player", "party1", "party2", "party3", "party4", ...(this.pets ? ["pet", "partypet1"] : [])].map(unit => ({
            key: "preview-" + unit, unit, pet: unit === "pet" || unit.startsWith("partypet"), group: "1",
        }));
    }
    public onChange(listener: (members: readonly GroupRosterMember[]) => void): () => void {
        return this.source?.onChange(listener) ?? (() => {});
    }
    public Dispose(): void { this.source?.Dispose(); }
}
