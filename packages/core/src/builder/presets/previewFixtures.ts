import { ProgressSource, UnitSource, UseSource } from "wuira/datasources";
import { unitTextChannels } from "../units/UnitWidgets";
import type { Properties, PropertyRule, PropertyRules, SourceInstance } from "../../core/builder";

/** Fixed authoring values. Preview never reads live health, power, auras, or spellbooks. */
export class SampleProgress extends ProgressSource {
    public constructor(current: number, maximum = 100) {
        super({
            current: () => current, min: () => 0, max: () => maximum,
            percent: () => maximum === 0 ? 0 : current / maximum * 100,
        });
    }
    protected Listen(): () => void { return () => {}; }
}

const sampleTexture = { Value: "Interface\\Icons\\INV_Misc_QuestionMark", IsSecret: () => false };
const sampleResourceColor = { r: .2, g: .45, b: .95, a: 1 };
function resourceColorChannel(channels: SourceInstance["channels"] = {}): SourceInstance["channels"] {
    return { ...channels, ResourceColor: { value: { Value: sampleResourceColor, IsSecret: () => false, onChange: () => () => {} } } };
}

const progressDefaults: Record<string, [number, number]> = {
    hp: [75, 100], mana: [40, 200], power: [40, 100], aura: [8, 15], cast: [1, 2.5],
    spell: [4, 10], cooldown: [4, 10], gcd: [4, 10], swing: [4, 10], totem: [4, 10],
};

function authored(props: Properties | undefined, key: string, fallback: number): number {
    const value = props?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function initialDefaults(type: string): Record<string, string> {
    const pair = progressDefaults[type] ?? (type === "unit" ? [75, 100] as [number, number] : undefined);
    const result: Record<string, string> = {};
    if (pair !== undefined) { result.initial = String(pair[0]); result.maximum = String(pair[1]); }
    if (type === "class") result.text = "PRIEST";
    else if (type === "unit") result.text = "Sample";
    else if (type === "cast") result.text = "Sample cast";
    else if (type === "spell" || type === "cooldown" || type === "gcd" || type === "swing" || type === "totem") result.text = "Sample spell";
    return result;
}

/** Fields a parent-supplied input may store so its own preview has a resting value. */
export function initialProperties(type: string): PropertyRules {
    const defaults = initialDefaults(type);
    const rules: Record<string, PropertyRule> = {};
    if (defaults.initial !== undefined) rules.initial = { type: "number", min: 0, max: 1000000000 };
    if (defaults.maximum !== undefined) rules.maximum = { type: "number", min: 0, max: 1000000000 };
    if (defaults.text !== undefined) rules.text = { type: "string" };
    return rules;
}

export function previewSource(type: string, props?: Properties): SourceInstance | undefined {
    const pair = progressDefaults[type];
    if (pair === undefined) return undefined;
    const current = authored(props, "initial", pair[0]);
    const maximum = Math.max(authored(props, "maximum", pair[1]), 0);
    const progress = new SampleProgress(current, maximum === 0 ? 1 : maximum);
    const text = typeof props?.text === "string" && props.text !== "" ? props.text : initialDefaults(type).text;
    if (type === "hp") return {
        progress, value: new SampleProgress(current, maximum === 0 ? 1 : maximum),
        channels: {
            healPrediction: { progress: new SampleProgress(current * 1.6, Math.max(maximum * 10, 1)) },
            absorb: { progress: new SampleProgress(current * 80 / 75, Math.max(maximum * 10, 1)) },
        },
    };
    if (type === "mana") return {
        progress, value: new SampleProgress(current, maximum === 0 ? 1 : maximum),
        channels: resourceColorChannel({ regen: { progress: new SampleProgress(current * 15 / 40, 100) } }),
    };
    if (type === "power") return {
        progress, value: new SampleProgress(current, maximum === 0 ? 1 : maximum),
        channels: resourceColorChannel({ color: { Text: () => "MANA" } }),
    };
    if (type === "aura") return { progress, texture: sampleTexture as SourceInstance["texture"], IsActive: () => true, Alpha: () => 1 };
    if (type === "cast") return { progress, IsActive: () => true, Text: () => text ?? "Sample cast" };
    return {
        progress, texture: sampleTexture as SourceInstance["texture"],
        action: { type: "spell", spell: "Holy Light" }, IsActive: () => true, Text: () => text ?? "Sample spell",
    };
}

export const previewSpells = [
    { id: 635, name: "Holy Light", isPassive: false },
    { id: 498, name: "Divine Protection", isPassive: false },
    { id: 642, name: "Divine Shield", isPassive: false },
    { id: 19740, name: "Blessing of Might", isPassive: false },
];

export const previewList = [
    { key: "row-1", label: "Sample row 1" },
    { key: "row-2", label: "Sample row 2" },
    { key: "row-3", label: "Sample row 3" },
];

const previewMembers = [
    { key: "preview-player", unit: "player", group: "1" },
    { key: "preview-party1", unit: "party1", group: "1" },
    { key: "preview-party2", unit: "party2", group: "1" },
];

/** Standalone editor preview of a component whose inputs are supplied by a parent. */
export function previewInput(type: string, props?: Properties): SourceInstance {
    const typed = previewSource(type, props);
    if (typed !== undefined) return typed;
    if (type === "unit") {
        const target = UseSource(UnitSource, typeof props?.unit === "string" && props.unit !== "" ? props.unit : "player");
        return { unit: target, channels: unitTextChannels(target.Token, true, props) };
    }
    if (type === "repeatItem") return { value: { Value: { key: "sample", label: "Sample item" }, IsSecret: () => false } as SourceInstance["value"], Text: () => "Sample item", ...previewSource("spell") };
    if (type === "list") return { items: { Value: previewList, onChange: () => () => {} }, ItemsKey: item => (item as { key: string }).key };
    if (type === "knownSpells") return {
        items: { Value: previewSpells, onChange: () => () => {} }, ItemsKey: item => (item as { id: number }).id,
        BindItem: () => previewSource("spell")!,
    };
    if (type === "groupMembers") return {
        items: { Value: previewMembers, onChange: () => () => {} },
        ItemsKey: item => (item as { key: string }).key,
        ItemsGroup: item => (item as { group: string }).group,
        ItemsUnit: item => (item as { unit: string }).unit,
    };
    if (type === "class") { const text = typeof props?.text === "string" && props.text !== "" ? props.text : "PRIEST"; return { value: { Value: text, IsSecret: () => false } as SourceInstance["value"], Text: () => text }; }
    return { value: { Value: "Sample", IsSecret: () => false } as SourceInstance["value"], Text: () => "Sample", IsActive: () => true };
}
