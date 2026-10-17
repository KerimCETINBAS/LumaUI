import type { DataValue, Properties } from "lumaui/core";
export function formatOutput(values: Record<string, string>, prefix: string, value: DataValue | undefined, dataKey = prefix): void {
    const color = typeof value === "object" && value !== null && !Array.isArray(value) && ["r", "g", "b"].every(key => typeof value[key] === "number");
    values[prefix + ".type"] = value === undefined ? "none" : color ? "color" : typeof value === "object" ? "data" : typeof value;
    values[prefix + ".text"] = typeof value === "object" || value === undefined ? "" : String(value);
    values[prefix + ".dataKey"] = dataKey;
    if (color) for (const key of ["r", "g", "b", "a"]) values[prefix + "." + key] = String((value as Properties)[key] ?? 1);
}
export function parseOutput(values: Record<string, string>, prefix: string, original?: DataValue): DataValue | undefined {
    const type = values[prefix + ".type"] ?? "none", raw = values[prefix + ".text"] ?? "";
    if (type === "none") return undefined;
    if (type === "data") return original;
    if (type === "string") return raw;
    if (type === "number") { const value = Number(raw); if (raw.trim() === "" || !Number.isFinite(value)) throw "Enter a finite output number"; return value; }
    if (type === "boolean") { if (!["true", "false"].includes(raw)) throw "Choose true or false"; return raw === "true"; }
    if (type === "color") {
        const result: Properties = {};
        for (const key of ["r", "g", "b", "a"]) { const raw = values[prefix + "." + key] ?? "1"; const value = Number(raw); if (raw.trim() === "" || !Number.isFinite(value) || value < 0 || value > 1) throw "Color channels must be between 0 and 1"; result[key] = value; }
        return result;
    }
    throw "Unknown output type";
}
export function formatCases(values: Record<string, string>, input: DataValue | undefined): void {
    const cases = Array.isArray(input) ? input : [];
    values["cases.count"] = String(cases.length);
    cases.forEach((entry, index) => {
        const row = entry as Properties, prefix = "cases." + index;
        values[prefix + ".matchType"] = typeof row.equals; values[prefix + ".equals"] = String(row.equals);
        formatOutput(values, prefix + ".output", row.value, String(index));
    });
}
export function parseCases(values: Record<string, string>, original: DataValue | undefined): DataValue[] {
    const result: DataValue[] = [];
    for (let index = 0; index < Number(values["cases.count"] ?? "0"); index++) {
        const prefix = "cases." + index, raw = values[prefix + ".equals"] ?? "", type = values[prefix + ".matchType"] ?? "string";
        let equals: DataValue = raw;
        if (type === "number") { equals = Number(raw); if (raw.trim() === "" || !Number.isFinite(equals)) throw "Case match must be a finite number"; }
        else if (type === "boolean") { if (!["true", "false"].includes(raw)) throw "Case match must be true or false"; equals = raw === "true"; }
        const old = Array.isArray(original) ? original[Number(values[prefix + ".output.dataKey"])] as Properties | undefined : undefined;
        const value = parseOutput(values, prefix + ".output", old?.value);
        if (value === undefined) throw "Each case needs an output";
        result.push({ equals, value });
    }
    return result;
}
