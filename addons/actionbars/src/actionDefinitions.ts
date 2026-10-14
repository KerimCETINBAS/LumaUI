import { Spells } from "wuira";
import type { KnownSpells } from "wuira/datasources";
import { sealSpellIds, blessingSpellIds, auraSpellIds } from "./spells";

export interface Action { spell: number; binding?: string; }
export interface ActionRow {
    size: number;
    actions: readonly Action[];
    /** Wrap after this many equal-sized buttons; each line is centered. */
    columns?: number;
}
export const defaultActionRows: readonly ActionRow[] = [
    { size: 28, actions: [
        { spell: Spells.Judgement, binding: "1" },
        { spell: Spells.HolyStrike, binding: "2" },
        { spell: Spells.Consecration, binding: "3" },
        { spell: Spells.HolyShock, binding: "4" },
        { spell: Spells.Exorcism, binding: "5" },
    ] },
    { size: 32, actions: [
        { spell: Spells.DivineFavor, binding: "6" },
        { spell: Spells.LayOnHands, binding: "7" },
        { spell: Spells.BlessingOfProtection, binding: "8" },
        { spell: Spells.BlessingOfFreedom, binding: "9" },
        { spell: Spells.VoiceOfTruth, binding: "0" },
        { spell: Spells.HammerOfJustice, binding: "-" },
    ] },
    { size: 24, actions: sealSpellIds.map(spell => ({ spell })) },
    { size: 24, actions: blessingSpellIds.map(spell => ({ spell })) },
];

export function resolveBinding(action: Action, overrides: Readonly<Record<string, string>>): string | undefined {
    const override = overrides[String(action.spell)];
    return override === undefined ? action.binding : override === "" ? undefined : override;
}

export function createActionRows(known: KnownSpells, overrides: Readonly<Record<string, string>> = {}): ActionRow[] {
    const rows: ActionRow[] = defaultActionRows.map(row => ({ ...row,
        actions: row.actions.filter(action => known.Has(action.spell))
            .map(action => ({ spell: action.spell, binding: resolveBinding(action, overrides) })),
    })).filter(row => row.actions.length > 0);

    const excludedIds = new Set<number>(auraSpellIds);
    for (const row of defaultActionRows) for (const action of row.actions) excludedIds.add(action.spell);
    const excludedNames = new Set<string>();
    for (const id of excludedIds) {
        const name = known.Find(id)?.name;
        if (name !== undefined) excludedNames.add(name);
    }
    const seen = new Set<string>();
    const remaining: Action[] = [];
    for (const entry of known.Entries) {
        if (entry.isPassive !== false || entry.name === undefined || excludedIds.has(entry.id)
            || excludedNames.has(entry.name) || seen.has(entry.name)) continue;
        seen.add(entry.name);
        const action = { spell: entry.id };
        remaining.push({ ...action, binding: resolveBinding(action, overrides) });
    }
    if (remaining.length > 0) rows.push({ size: 24, columns: 8, actions: remaining });
    return rows;
}
