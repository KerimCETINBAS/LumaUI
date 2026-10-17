import { SourceConverter, ClassSource, ProgressSource } from "wuira/datasources";
import type { ValueSource } from "wuira/datasources";
import type { DataValue, Properties, SourceInstance } from "../core/builder";
import type { Presets } from "./Presets";
import { MathFormula } from "./MathFormula";
import { UnitConnection } from "./UnitConnection";
import { array, copy, fail, keys, record, text } from "./validate";

export function validateValuePath(path: string): void {
    for (const part of path.split(".")) if (part === "" || ["__proto__", "prototype", "constructor"].includes(part)) fail("invalid value path");
}
function at(value: unknown, path: string): unknown {
    for (const key of path === "" ? [] : path.split(".")) {
        if (issecretvalue(value)) fail("restricted converter input");
        if (value === undefined) return undefined;
        if (typeof value !== "object" || value === null || Array.isArray(value)) fail("input path requires an object");
        value = (value as Record<string, unknown>)[key];
        if (value === undefined) fail("missing input path: " + path);
    }
    return value;
}
/** One checked value path; the converter never owns the shared source instance. */
export function sourceValue(instance: SourceInstance, path = ""): SourceConverter<unknown, unknown> {
    validateValuePath(path === "" ? "Value" : path);
    const input = instance.value ?? instance.progress ?? instance.texture;
    if (input === undefined) fail("source has no readable value");
    return new SourceConverter(input as ValueSource<unknown>, value => at(value, path));
}
export function validateCases(value: unknown): void {
    const seen = new Set<string>();
    for (const entry of array(value, 64)) {
        const row = record(entry); keys(row, ["equals", "value"]);
        const key = row.equals;
        if (!["string", "number", "boolean"].includes(typeof key) || typeof key === "number" && !Number.isFinite(key)) fail("invalid case match value");
        if (row.value === undefined) fail("case output is required");
        const identity = typeof key + ":" + String(key);
        if (seen.has(identity)) fail("duplicate case match value");
        seen.add(identity); copy(row.value);
    }
}
function output(source: ValueSource<unknown>): SourceInstance {
    return {
        value: source,
        IsActive: () => { const value = source.Value; if (typeof value !== "boolean") fail("visibility requires a boolean converter output"); return value; },
        Text: () => { const value = source.Value; if (value === undefined) return ""; if (!["string", "number", "boolean"].includes(typeof value)) fail("text requires a scalar converter output"); return String(value); },
        Alpha: () => { const value = source.Value; if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) fail("opacity requires a converter output between 0 and 1"); return value; },
    };
}
class ConverterProgress extends ProgressSource {
    public constructor(private readonly converter: SourceConverter<unknown, number>, min: number, max: number) {
        super({ current: () => converter.Value, min: () => min, max: () => max, percent: () => (converter.Value - min) / (max - min) * 100 });
    }
    protected Listen(_frame: wuiraNativeFrame, refresh: () => void): () => void { return this.converter.onChange(refresh); }
}
export function registerConverterSources(presets: Presets): void {
    presets.RegisterSource("unitConnection", { properties: { unit: { type: "string" } }, Create: (props, context) => {
        const source = new UnitConnection(context.Unit(props.unit as string | undefined ?? "player"), context.Preview === true);
        return { value: source, Dispose: () => source.Dispose() };
    } });
    presets.RegisterSource("class", { properties: { unit: { type: "string" } }, Create: (props, context) => {
        const source = new ClassSource(context.Unit(props.unit as string | undefined ?? "player"));
        return { value: source, Dispose: () => source.Dispose() };
    } });
    const input = { source: { type: "string", required: true }, path: { type: "string" } } as const;
    const validateInput = (props: Properties) => { if (props.path !== undefined) validateValuePath(text(props.path, "input path", 128)); };
    presets.RegisterSource("caseConverter", { properties: { ...input, cases: { type: "cases", required: true }, default: { type: "value" } }, references: ["source"],
        Validate: props => { validateInput(props); validateCases(props.cases); },
        Create: (props, context) => {
            const read = sourceValue(context.Source(props.source as string), props.path as string | undefined);
            const cases = props.cases as unknown as { equals: string | number | boolean; value: DataValue }[];
            const converter = new SourceConverter(read, value => {
                for (const entry of cases) if (value === entry.equals) return entry.value;
                return props.default;
            });
            return { ...output(converter), Dispose: () => { converter.Dispose(); read.Dispose(); } };
        } });
    presets.RegisterSource("mathConverter", { properties: { ...input, expression: { type: "string", required: true },
        min: { type: "number", min: -1000000000, max: 1000000000 }, max: { type: "number", min: -1000000000, max: 1000000000 } }, references: ["source"],
        Validate: props => {
            validateInput(props); new MathFormula(text(props.expression, "math expression", 256));
            if ((props.min as number | undefined ?? 0) >= (props.max as number | undefined ?? 100)) fail("progress maximum must exceed minimum");
        },
        Create: (props, context) => {
            const read = sourceValue(context.Source(props.source as string), props.path as string | undefined);
            const formula = new MathFormula(props.expression as string);
            const converter = new SourceConverter(read, value => formula.Evaluate(value as number));
            const progress = new ConverterProgress(converter, props.min as number | undefined ?? 0, props.max as number | undefined ?? 100);
            return { ...output(converter), progress, Dispose: () => { converter.Dispose(); read.Dispose(); } };
        } });
}
