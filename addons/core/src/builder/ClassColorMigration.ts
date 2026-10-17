import type { PresetDocument, PresetNode, Properties, DataValue } from "../core/builder";
import { fail } from "./validate";
declare const RAID_CLASS_COLORS: Readonly<Record<string, { r: number; g: number; b: number }>> | undefined;

/** One-way conversion of retired styling flags into ordinary editable source data. */
export function migrateClassColors(document: PresetDocument): boolean {
    let changed = false;
    const names = new Set(document.sources.map(source => source.name));
    const mapped = new Map<string, string>();
    const nextName = (prefix: string) => { let i = 1; while (names.has(prefix + i)) i++; const name = prefix + i; names.add(name); return name; };
    const visit = (node: PresetNode) => {
        if (node.type === "secureButton") {
            const props = node.props as Properties;
            for (const flag of ["classBorder", "classBackground"]) if (props[flag] !== undefined && typeof props[flag] !== "boolean") fail("invalid retired class color setting");
            const border = props.classBorder === true && node.bindings?.borderColor === undefined, background = props.classBackground === true && node.bindings?.backgroundColor === undefined;
            if (props.classBorder !== undefined || props.classBackground !== undefined) {
                delete props.classBorder; delete props.classBackground; changed = true;
            }
            const unit = typeof props.unit === "string" ? props.unit : props.clickCastPreset === undefined ? undefined : "target";
            if ((border || background) && unit !== undefined) {
                let converted = mapped.get(unit);
                if (converted === undefined) {
                    const input = nextName("unit-class-"), output = nextName("class-color-");
                    const cases: DataValue[] = [];
                    for (const [token, color] of Object.entries(RAID_CLASS_COLORS ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) if (!issecretvalue(color) && typeof color === "object" && color !== null && [color.r, color.g, color.b].every(value => !issecretvalue(value) && typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1))
                        cases.push({ equals: token, value: { r: color.r, g: color.g, b: color.b, a: 1 } });
                    document.sources.push({ name: input, type: "class", props: { unit } },
                        { name: output, type: "caseConverter", props: { source: input, path: "token", cases, default: { r: .35, g: .4, b: .45, a: 1 } } });
                    converted = output; mapped.set(unit, output);
                }
                node.bindings = { ...node.bindings,
                    ...(border && node.bindings?.borderColor === undefined ? { borderColor: { source: converted } } : {}),
                    ...(background && node.bindings?.backgroundColor === undefined ? { backgroundColor: { source: converted } } : {}) };
            }
        }
        for (const child of node.children ?? []) visit(child);
    };
    visit(document.root);
    for (const dependency of document.dependencies ?? []) changed = migrateClassColors(dependency) || changed;
    return changed;
}
