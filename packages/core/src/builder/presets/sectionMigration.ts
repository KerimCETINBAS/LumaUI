import type { ElementSection, PresetDocument, PresetNode, Properties } from "../../core/builder";

function colorOf(value: unknown): ElementSection["color"] | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const record = value as { color?: { r?: number; g?: number; b?: number; a?: number }; r?: number; g?: number; b?: number; a?: number };
    const color = record.color ?? record;
    if (typeof color.r !== "number" || typeof color.g !== "number" || typeof color.b !== "number") return undefined;
    return { r: color.r, g: color.g, b: color.b, ...(color.a === undefined ? {} : { a: color.a }) };
}

function push(node: PresetNode, section: ElementSection): void {
    const sections = [...(node.sections ?? [])];
    if (!sections.some(existing => existing.source === section.source && existing.key === section.key)) sections.push(section);
    node.sections = sections;
}

function visit(document: PresetDocument, node: PresetNode): void {
    if (node.type === "progress") {
        const props = node.props as Properties;
        if (node.source !== undefined && props.healPrediction !== undefined && props.healPrediction !== false) push(node, { source: node.source, key: "healPrediction", color: colorOf(props.healPrediction) });
        if (node.source !== undefined && props.absorbPrediction !== undefined && props.absorbPrediction !== false) push(node, { source: node.source, key: "absorb", color: colorOf(props.absorbPrediction) });
        delete props.healPrediction; delete props.absorbPrediction;
        if (typeof props.powerColorUnit === "string") {
            const token = props.powerColorUnit;
            let power = document.sources.find(source => source.type === "power" && (source.props.unit ?? "player") === token);
            if (power === undefined) {
                let name = "power." + token, suffix = 1;
                while (document.sources.some(source => source.name === name)) name = "power." + token + "." + suffix++;
                power = { name, type: "power", props: { unit: token } };
                document.sources.push(power);
            }
            push(node, { source: power.name, key: "color" });
            delete props.powerColorUnit;
        }
    }
    for (const child of node.children ?? []) visit(document, child);
}

/** Old widget and source toggles become source-key sections. Saved documents keep their visuals. */
export function migrateSections(document: PresetDocument): void {
    for (const source of document.sources) {
        if (source.isProp) continue;
        delete source.props.healPrediction; delete source.props.absorbPrediction; delete source.props.regenTimer;
    }
    visit(document, document.root);
}
