interface AuraData { icon?: number; spellId?: number; dispelName?: string; }
interface AuraReader { GetAuraDataByIndex?: (this: void, unit: string, index: number, filter: string) => AuraData | undefined; }
/** Public fields classify auras; secret values never enter comparisons or arithmetic. */
export function readUnitAuras(unit: string, category: string, movement: ReadonlySet<number>, limit: number): { icons: (number | undefined)[]; restricted: boolean } {
    const api = C_UnitAuras as AuraReader | undefined;
    const icons: (number | undefined)[] = [];
    if (api?.GetAuraDataByIndex === undefined) return { icons, restricted: true };
    const filter = category === "buffs" ? "HELPFUL" : category === "dispellable" ? "HARMFUL|RAID_PLAYER_DISPELLABLE" : "HARMFUL";
    let restricted = false;
    try {
        for (let index = 1; index <= 128; index++) {
            const aura = api.GetAuraDataByIndex(unit, index, filter);
            if (issecretvalue(aura)) { restricted = true; break; }
            if (aura === undefined) break;
            const movementKnown = !issecretvalue(aura.spellId), dispelKnown = !issecretvalue(aura.dispelName);
            if ((category === "movement" && !movementKnown) || (category === "dispellable" && !dispelKnown)) { restricted = true; continue; }
            const moving = movementKnown && aura.spellId !== undefined && movement.has(aura.spellId);
            const curable = dispelKnown && (aura.dispelName === "Disease" || aura.dispelName === "Poison");
            if (category === "movement" && !moving || category === "dispellable" && !curable || category === "other" && (moving || curable)) continue;
            icons.push(aura.icon); if (icons.length >= limit) break;
        }
    } catch { restricted = true; }
    return { icons, restricted };
}
