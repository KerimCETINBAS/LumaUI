import type { DataValue, Properties, PropertyRule, PropertyRules } from "../core/builder";
export function fail(message: string): never { throw "LumaUI builder: " + message; }
export function record(value: unknown): Record<string, unknown> {
    if (issecretvalue(value) || typeof value !== "object" || value === null || (Array.isArray(value) && Object.keys(value).length > 0)) fail("expected an object");
    return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, allowed: readonly string[]): void {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail("unknown field: " + key);
}
export function text(value: unknown, label: string, max = 128): string {
    if (issecretvalue(value) || typeof value !== "string" || value.length === 0 || value.length > max) fail("invalid " + label);
    return value;
}
export function identifier(value: unknown): string {
    const name = text(value, "identifier", 96);
    for (let i = 0; i < name.length; i++) if (!"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-".includes(name[i])) fail("invalid identifier: " + name);
    return name;
}
export function array(value: unknown, max = 256): unknown[] {
    if (issecretvalue(value) || !Array.isArray(value) || value.length > max) fail("invalid or oversized array");
    // CBOR tables may contain map entries alongside the array part.
    if (Object.keys(value).length !== value.length) fail("unexpected array fields");
    return value;
}
/** Detached data only: no functions, native handles, cycles or secret values. */
export function copy(value: unknown, depth = 0, seen = new Set<object>(), budget = { count: 0 }): DataValue {
    if (depth > 48 || ++budget.count > 16384 || issecretvalue(value)) fail("invalid or oversized data");
    if (typeof value === "string") { if (value.length > 16384) fail("text is too long"); return value; }
    if (typeof value === "number") { if (!Number.isFinite(value)) fail("non-finite number"); return value; }
    if (typeof value === "boolean") return value;
    if (typeof value !== "object" || value === null || seen.has(value)) fail("data must be serializable and acyclic");
    seen.add(value);
    let result: DataValue;
    if (Array.isArray(value)) result = array(value, 4096).map(item => copy(item, depth + 1, seen, budget));
    else {
        const input = record(value);
        const output: Properties = {};
        for (const key of Object.keys(input)) {
            if (["__proto__", "prototype", "constructor"].includes(key) || key.length > 128) fail("invalid property key");
            output[key] = copy(input[key], depth + 1, seen, budget);
        }
        result = output;
    }
    seen.delete(value);
    return result;
}
function number(value: unknown, rule: PropertyRule): void {
    if (typeof value !== "number" || !Number.isFinite(value) || value < (rule.min ?? -100000) || value > (rule.max ?? 100000)) fail("invalid number");
}
function check(value: DataValue, rule: PropertyRule): void {
    if (rule.values !== undefined && !rule.values.includes(value as string | number)) fail("invalid choice");
    if (rule.type === "number") number(value, rule);
    else if (rule.type === "string" || rule.type === "boolean") {
        if (typeof value !== rule.type) fail("invalid " + rule.type);
    } else if (rule.type === "size") { if (value !== "inherit") number(value, { type: "number", min: 0, max: 8192 }); }
    else if (rule.type === "spacing" && typeof value === "number") number(value, { type: "number", min: 0, max: 4096 });
    else if (rule.type === "numbers" || rule.type === "texCoords") {
        const values = array(value, 256);
        if (rule.type === "texCoords" && values.length !== 4) fail("texture coordinates require four values");
        for (const item of values) number(item, { type: "number", min: rule.type === "texCoords" ? 0 : 1, max: rule.type === "texCoords" ? 1 : 10000000 });
    } else if (rule.type === "textureOptions" || rule.type === "background" || rule.type === "border") {
        if ((rule.type === "background" || rule.type === "border") && value === false) return;
        const fields: PropertyRules = rule.type === "border" ? { color: { type: "color", required: true }, thickness: { type: "number", min: 0, max: 64 }, radius: { type: "number", min: 0, max: 256 }, texture: { type: "string" } }
            : { color: { type: "color" }, texture: { type: "string" }, tileX: { type: "boolean" }, tileY: { type: "boolean" }, texCoords: { type: "texCoords" }, blendMode: { type: "string", values: ["BLEND", "ADD", "MOD", "DISABLE", "ALPHAKEY"] } };
        properties(value, fields);
    } else {
        const object = record(value);
        if (rule.type === "color") {
            keys(object, ["r", "g", "b", "a"]);
            for (const k of ["r", "g", "b"]) number(object[k], { type: "number", min: 0, max: 1 });
            if (object.a !== undefined) number(object.a, { type: "number", min: 0, max: 1 });
        } else if (rule.type === "offset") {
            keys(object, ["x", "y"]); number(object.x, { type: "number" }); number(object.y, { type: "number" });
        } else if (rule.type === "spacing") {
            keys(object, ["top", "right", "bottom", "left"]);
            for (const k of Object.keys(object)) number(object[k], { type: "number", min: 0, max: 4096 });
        } else if (rule.type === "action") {
            const type = text(object.type, "action type");
            const field = type === "spell" ? "spell" : type === "item" ? "item" : type === "macro" ? "macro" : type === "action" ? "slot" : type === "target" ? "unit" : fail("invalid action type");
            keys(object, ["type", field, ...(type === "macro" ? [] : ["unit"])]);
            if (typeof object[field] !== "string" && typeof object[field] !== "number") fail("invalid action identifier");
            if (typeof object[field] === "number") number(object[field], { type: "number", min: 1, max: 10000000 });
            else text(object[field], "action identifier", 4096);
            if (field === "slot" && (typeof object.slot !== "number" || !Number.isInteger(object.slot))) fail("invalid action slot");
            if (object.unit !== undefined) text(object.unit, "action unit", 40);
        }
    }
}
export function properties(value: unknown, rules: PropertyRules): Properties {
    const data = record(value);
    keys(data, Object.keys(rules));
    for (const key of Object.keys(rules)) {
        const rule = rules[key];
        if (data[key] === undefined) { if (rule.required) fail("missing property: " + key); }
        else check(data[key] as DataValue, rule);
    }
    return data as Properties;
}
