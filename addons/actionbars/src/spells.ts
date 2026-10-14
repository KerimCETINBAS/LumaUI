import { Spells } from "wuira";

export const sealSpellIds = [
    Spells.SealOfRighteousness,
    Spells.SealOfTheCrusader,
    Spells.SealOfCommand,
    Spells.SealOfJustice,
    Spells.SealOfLight,
    Spells.SealOfWisdom,
    Spells.SealOfFury,
] as const;

// Protection and Freedom already belong to the utility row.
export const blessingSpellIds = [
    Spells.BlessingOfMight,
    Spells.BlessingOfWisdom,
    Spells.BlessingOfKings,
    Spells.BlessingOfLight,
    Spells.BlessingOfSalvation,
    Spells.BlessingOfSanctuary,
    Spells.BlessingOfSacrifice,
    Spells.GreaterBlessingOfMight,
    Spells.GreaterBlessingOfWisdom,
    Spells.GreaterBlessingOfKings,
    Spells.GreaterBlessingOfLight,
    Spells.GreaterBlessingOfSalvation,
    Spells.GreaterBlessingOfSanctuary,
] as const;

// Auras will have a separate tracker and never appear in the action panel.
export const auraSpellIds = [
    Spells.DevotionAura,
    Spells.RetributionAura,
    Spells.ConcentrationAura,
    Spells.ShadowResistanceAura,
    Spells.FrostResistanceAura,
    Spells.FireResistanceAura,
    Spells.SanctityAura,
] as const;
