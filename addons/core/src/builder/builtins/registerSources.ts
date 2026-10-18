import { UnitSource, HP, Mana, GlobalCooldown, SpellCooldown, CastTimer, AuraTimer, SwingTimer, SpellSource, TotemTimer, resolveUnit } from "wuira/datasources";
import type { GroupRosterMember, GroupScope, KnownSpell } from "wuira/datasources";
import { MicroBar } from "wuira/skins";
import type { MicroMenuSkinOptions } from "wuira/platform";
import type { Presets } from "../presets/Presets";
import type { Skins } from "../skins/Skins";
import { PrimaryPower, manaResourceColor, primaryResourceColor, unitTextChannels } from "../units/UnitWidgets";
import { hideNativeFrames } from "../skins/NativeVisibility";
import { createMicroMenu } from "../skins/MicroMenu";
import { registerConverterSources } from "../converters/ConverterSources";
import { GroupRoster } from "../units/GroupRoster";
import { listRecords } from "../units/ListRecords";
import { KnownSpellCollection } from "../../helpers/KnownSpells";
import { parseSpellSelectors } from "../../helpers/NameSelectors";
import { positive, reading, unit } from "./builtinRules";
import type { Properties, SourceChannel, SourceInstance } from "../../core/builder";
import { previewList, previewSource, previewSpells } from "../presets/previewFixtures";

const sourceChannels: Record<string, readonly SourceChannel[]> = {
    hp: [{ key: "progress", label: "Health" }, { key: "healPrediction", label: "Incoming heals" }, { key: "absorb", label: "Absorbs" }],
    mana: [{ key: "progress", label: "Mana" }, { key: "regen", label: "Mana regen" }],
    power: [{ key: "progress", label: "Power" }, { key: "color", label: "Power color" }],
    aura: [{ key: "progress", label: "Aura time" }, { key: "texture", label: "Aura icon" }, { key: "alpha", label: "Aura alpha" }],
    spell: [{ key: "progress", label: "Cooldown" }, { key: "texture", label: "Spell icon" }, { key: "action", label: "Spell action" }],
    cast: [{ key: "progress", label: "Cast" }, { key: "text", label: "Spell name" }],
    unit: [{ key: "name", label: "Name" }, { key: "surname", label: "Surname" }, { key: "fullName", label: "Full name" }, { key: "health", label: "Health text" }, { key: "percent", label: "Health percent" }, { key: "role", label: "Role" }, { key: "leader", label: "Leader" }, { key: "isLeader", label: "Is leader" }],
    cooldown: [{ key: "progress", label: "Cooldown" }], gcd: [{ key: "progress", label: "Global cooldown" }],
    swing: [{ key: "progress", label: "Swing" }], totem: [{ key: "progress", label: "Totem" }],
};

function previewReading(type: string, props: Properties, context: { Preview?: boolean }): SourceInstance | undefined {
    const authored = typeof props.initial === "number" || typeof props.maximum === "number" || typeof props.text === "string";
    if (context.Preview !== true || !authored) return undefined;
    return previewSource(type, props);
}

export function registerDataSources(presets: Presets, skins: Skins): void {
    presets.RegisterSource("unit", { capabilities: ["unit"], channels: sourceChannels.unit, properties: { ...unit, ...reading, text: { type: "string" } }, Create: (props, context) => {
        const target = context.Unit(props.unit as string | undefined ?? "player");
        const token = typeof target === "string" ? target : target.Token;
        return { unit: typeof target === "string" ? new UnitSource(target) : target, channels: unitTextChannels(token, context.Preview === true, props) };
    } });
    presets.RegisterSource("repeatItem", { properties: {}, Create: () => { throw "Repeat item input must be connected"; } });
    presets.RegisterSource("hp", { capabilities: ["value", "progress"], channels: sourceChannels.hp, properties: { ...unit, ...reading }, Create: (props, context) => {
        if (context.Preview === true) {
            const resolved = context.Unit(props.unit as string | undefined ?? "player");
            const sample = previewSource("hp", props)!;
            (sample.progress as unknown as { target: { Token: string } }).target = typeof resolved === "string" ? { Token: resolved } : resolved;
            return sample;
        }
        const hp = new HP(context.Unit(props.unit as string | undefined ?? "player"));
        hp.UseHealPrediction(); hp.UseAbsorbPrediction();
        return { value: hp, progress: hp, channels: { healPrediction: {}, absorb: {} } };
    } });
    presets.RegisterSource("mana", { capabilities: ["value", "progress"], channels: sourceChannels.mana, properties: { ...unit, ...reading }, Create: (props, context) => {
        const sample = context.Preview === true ? previewSource("mana", props) : undefined; if (sample !== undefined) return sample;
        const target = resolveUnit(context.Unit(props.unit as string | undefined ?? "player"));
        const mana = new Mana(target);
        if (mana.unit === "player") mana.UseRegenTimer();
        const color = manaResourceColor(target);
        return { value: mana, progress: mana, channels: { ResourceColor: { value: color }, ...(mana.RegenTimer === undefined ? {} : { regen: { progress: mana.RegenTimer } }) }, Dispose: () => { color.Dispose(); mana.RegenTimer?.Dispose(); } };
    } });
    presets.RegisterSource("power", { capabilities: ["value", "progress"], channels: sourceChannels.power, properties: { ...unit, ...reading }, Create: (props, context) => {
        const sample = context.Preview === true ? previewSource("power", props) : undefined; if (sample !== undefined) return sample;
        const target = resolveUnit(context.Unit(props.unit as string | undefined ?? "player"));
        const power = new PrimaryPower(target);
        const color = primaryResourceColor(target);
        return { value: power, progress: power, channels: { ResourceColor: { value: color } }, Dispose: () => color.Dispose() };
    } });
    presets.RegisterSource("list", { capabilities: ["items"], properties: { items: { type: "value" } }, Validate: props => { listRecords(props); },
        Create: (props, context) => { const values = listRecords(props); const items = context.Preview === true && values.length === 0 ? previewList : values; return { items: { Value: items, onChange: () => () => {} }, ItemsKey: item => (item as { key: string | number }).key }; } });
    presets.RegisterSource("groupMembers", { capabilities: ["items", "ItemsUnit", "ItemsTemplate"], properties: { scope: { type: "string", values: ["auto", "party", "raid"] }, pets: { type: "boolean" } },
        Create: (props, context) => {
            const list = new GroupRoster(props.scope as GroupScope | undefined ?? "auto", props.pets === true, context.Manual === true, context.Preview === true);
            return { items: list, ItemsKey: item => (item as GroupRosterMember).key,
                ItemsGroup: item => (item as GroupRosterMember).group, ItemsUnit: item => (item as GroupRosterMember).unit,
                ItemsTemplate: item => (item as GroupRosterMember).pet ? 1 : 0, Dispose: () => list.Dispose() };
        } });
    presets.RegisterSource("knownSpells", { capabilities: ["items", "BindItem"], properties: { selectors: { type: "string" }, includePassive: { type: "boolean" } },
        Validate: props => { parseSpellSelectors(props.selectors as string | undefined ?? ""); },
        Create: (props, context) => {
            const list = new KnownSpellCollection(parseSpellSelectors(props.selectors as string | undefined ?? ""), props.includePassive === true);
            if (context.Preview === true && list.Value.length === 0) { list.Dispose(); return { items: { Value: previewSpells, onChange: () => () => {} }, ItemsKey: item => (item as { id: number }).id, BindItem: () => previewSource("spell")! }; }
            return { items: list, ItemsKey: item => (item as KnownSpell).id, BindItem: read => {
                const spell = new SpellSource((read() as KnownSpell).id);
                return { progress: spell.Cooldown, action: spell.Action, texture: spell.Texture, cooldown: spell.Cooldown,
                    Text: () => (read() as KnownSpell).name ?? "", IsActive: () => (read() as KnownSpell).isPassive === false };
            }, Dispose: () => list.Dispose() };
        } });
    presets.RegisterListHelper("KnownSpells", { source: "knownSpells", Parse: argumentsText => {
        parseSpellSelectors(argumentsText); return { selectors: argumentsText };
    } });
    presets.RegisterSource("channel", { properties: { source: { type: "string", required: true }, channel: { type: "string", required: true } }, references: ["source"],
        Create: (props, context) => { const channel = context.Source(props.source as string).channels?.[props.channel as string]; if (channel === undefined) throw "Missing source channel"; return channel; } });
    presets.RegisterSource("totem", { capabilities: ["progress", "IsActive"], channels: sourceChannels.totem, properties: { spellId: { ...positive, editor: "spell", required: true }, ...reading }, Create: (props, context) => { const resting = previewReading("totem", props, context); if (resting !== undefined) return resting; const timer = new TotemTimer(props.spellId as number); return { progress: timer, IsActive: () => timer.IsActive }; } });
    presets.RegisterSource("gcd", { capabilities: ["progress", "IsActive"], channels: sourceChannels.gcd, properties: reading, Create: (props, context) => { const resting = previewReading("gcd", props, context); if (resting !== undefined) return resting; const timer = new GlobalCooldown(); return { progress: timer, IsActive: () => timer.IsActive }; } });
    presets.RegisterSource("cooldown", { capabilities: ["progress"], channels: sourceChannels.cooldown, properties: { spellId: { ...positive, editor: "spell", required: true }, ...reading },
        Create: (props, context) => { const resting = previewReading("cooldown", props, context); if (resting !== undefined) return resting; return { progress: new SpellCooldown(props.spellId as number) }; } });
    presets.RegisterSource("cast", { capabilities: ["progress", "IsActive", "Text"], channels: sourceChannels.cast, properties: { ...unit, ...reading, text: { type: "string" } }, Create: (props, context) => { const resting = previewReading("cast", props, context); if (resting !== undefined) return resting; const timer = new CastTimer(context.Unit(props.unit as string | undefined ?? "player")); return { progress: timer, IsActive: () => timer.IsActive, Text: () => timer.SpellName }; } });
    presets.RegisterSource("swing", { capabilities: ["progress", "IsActive"], channels: sourceChannels.swing, properties: reading, Create: (props, context) => { const resting = previewReading("swing", props, context); if (resting !== undefined) return resting; const swing = new SwingTimer(); return { progress: swing, IsActive: () => swing.IsActive, Dispose: () => swing.Dispose() }; } });
    presets.RegisterSource("aura", { capabilities: ["progress", "texture", "IsActive", "Alpha"], channels: sourceChannels.aura, properties: { ...unit, spellId: { ...positive, editor: "spell" }, spellIds: { type: "numbers", editor: "spell" }, activeAlpha: { type: "number", min: 0, max: 1 }, inactiveAlpha: { type: "number", min: 0, max: 1 },
        filter: { type: "string", values: ["HELPFUL", "HARMFUL", "HELPFUL|PLAYER", "HARMFUL|PLAYER"] }, ...reading }, Create: (props, context) => {
            const resting = previewReading("aura", props, context); if (resting !== undefined) return resting;
            const aura = new AuraTimer(context.Unit(props.unit as string | undefined ?? "player"), { spellIds: props.spellIds as number[] | undefined ?? [props.spellId as number], filter: props.filter as "HELPFUL" | "HARMFUL" | "HELPFUL|PLAYER" | "HARMFUL|PLAYER" | undefined });
            return { progress: aura, texture: aura.Texture, IsActive: () => aura.IsActive, Alpha: () => aura.Status === "active" ? props.activeAlpha as number | undefined ?? 1 : props.inactiveAlpha as number | undefined ?? 1 };
        } });
    presets.RegisterSource("spell", { capabilities: ["progress", "action", "texture", "cooldown"], channels: sourceChannels.spell, properties: { spellId: { ...positive, editor: "spell", required: true }, ...reading, text: { type: "string" } }, Create: (props, context) => {
        const resting = previewReading("spell", props, context); if (resting !== undefined) return resting;
        const spell = new SpellSource(props.spellId as number);
        return { progress: spell.Cooldown, action: spell.Action, texture: spell.Texture, cooldown: spell.Cooldown };
    } });
    skins.RegisterTarget("unitFrames", { properties: { player: { type: "boolean" }, target: { type: "boolean" }, focus: { type: "boolean" } }, Apply: props => hideNativeFrames(props) });
    skins.RegisterTarget("compactMicroMenu", { properties: {}, Apply: () => createMicroMenu() });
    skins.RegisterTarget("microBar", { properties: {
        background: { type: "color" }, border: { type: "color" }, buttonBackground: { type: "color" },
        icon: { type: "color" }, accent: { type: "color" }, disabledIcon: { type: "color" },
        padding: { type: "number", min: 0, max: 64 }, panel: { type: "boolean" },
    }, Apply: props => { const bar = new MicroBar().Style(props as unknown as MicroMenuSkinOptions); return () => bar.Dispose(); } });
    registerConverterSources(presets);
}
