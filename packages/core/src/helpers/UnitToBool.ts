import type { UnitInput } from "wuira/datasources";
import type { UnitFilter, UnitPredicate } from "../core/builder";
import { fail, properties } from "../builder/validate";
import type { PropertyRules } from "../core/builder";

declare function UnitGUID(this: void, unit: string): string | undefined;
declare function UnitName(this: void, unit: string): string | undefined;
declare function UnitClass(this: void, unit: string): wuiraNativeReturns<[string | undefined, string | undefined, number | undefined]>;
declare function UnitIsPlayer(this: void, unit: string): boolean;
declare function UnitIsFriend(this: void, first: string, second: string): boolean;
declare function UnitCanAttack(this: void, first: string, second: string): boolean;

export const unitFilterProperties: PropertyRules = {
    npcIds: { type: "numbers" }, name: { type: "string" }, classes: { type: "string" },
    player: { type: "boolean" }, friendly: { type: "boolean" }, attackable: { type: "boolean" },
};
/** Stateless, checked unit -> boolean conversion. Criteria combine with AND; lists use OR. */
export function UnitToBool(options: UnitFilter = {}): UnitPredicate {
    properties(options, unitFilterProperties);
    const npcIds = options.npcIds?.slice();
    if (npcIds?.some(id => !Number.isInteger(id))) fail("NPC IDs must be integers");
    const name = options.name, player = options.player, friendly = options.friendly, attackable = options.attackable;
    const classes = options.classes?.split(",").map(value => value.trim().toUpperCase());
    if (classes?.some(value => value === "" || value.split("").some(char => !"ABCDEFGHIJKLMNOPQRSTUVWXYZ".includes(char)))) fail("classes must be comma-separated class tokens");
    return (unit: UnitInput): boolean => {
        if (issecretvalue(unit)) return false;
        const token = typeof unit === "string" ? unit : unit.Token;
        if (issecretvalue(token) || typeof token !== "string" || token === "") return false;
        const guid = UnitGUID(token);
        if (issecretvalue(guid) || guid === undefined) return false;
        if (npcIds !== undefined) {
            const parts = guid.split("-");
            if (!["Creature", "Vehicle"].includes(parts[0]) || !npcIds.includes(Number(parts[5]))) return false;
        }
        if (name !== undefined) { const value = UnitName(token); if (issecretvalue(value) || value !== name) return false; }
        if (classes !== undefined) { const [, value] = UnitClass(token); if (issecretvalue(value) || value === undefined || !classes.includes(value)) return false; }
        if (player !== undefined) { const value = UnitIsPlayer(token); if (issecretvalue(value) || value !== player) return false; }
        if (friendly !== undefined) { const value = UnitIsFriend("player", token); if (issecretvalue(value) || value !== friendly) return false; }
        if (attackable !== undefined) { const value = UnitCanAttack("player", token); if (issecretvalue(value) || value !== attackable) return false; }
        return true;
    };
}
