import type { PresetDocument, PresetNode, SourceSpec } from "../../core/builder";
import { copy, fail } from "../validate";

function nodeSources(node: PresetNode): string[] {
    const names: string[] = [];
    for (const key of ["source", "visibleSource", "glowSource", "textSource", "alphaSource"] as const) if (node[key] !== undefined) names.push(node[key]!);
    names.push(...Object.values(node.bindings ?? {}).map(binding => binding.source), ...Object.values(node.sourceProps ?? {}).filter(value => ![".$item", ".$unit", ".$pet"].some(suffix => value.endsWith(suffix))));
    return names;
}

/** Extract legacy inline templates without altering caller data. Generated names remain visible/editable. */
export function migrateRepeats(document: PresetDocument, references: (type: string) => readonly string[], occupied: Set<string>, existing: ReadonlyMap<string, PresetDocument> = new Map()): PresetDocument[] {
    // Earlier editor versions generated these empty placeholders. Remove only that exact
    // empty shape when every use is a Repeat list binding; keep configured/shared/user inputs.
    const placeholders = new Set(document.sources.filter(source => !source.isProp && (source.name === "items" || source.name.startsWith("items-") && Number.isInteger(Number(source.name.slice(6))) && Number(source.name.slice(6)) > 0 && String(Number(source.name.slice(6))) === source.name.slice(6)) && source.type === "list" && Object.keys(source.props).length === 1 && Array.isArray(source.props.items) && source.props.items.length === 0).map(source => source.name));
    const candidates = new Set<string>();
    const inspect = (node: PresetNode): void => {
        if (node.type === "foreach" && node.source !== undefined && placeholders.has(node.source)) candidates.add(node.source);
        const other = { ...node }; if (node.type === "foreach") delete other.source;
        for (const name of [...nodeSources(other), node.props.unit, node.props.powerColorUnit, node.props.filter]) if (typeof name === "string") placeholders.delete(name);
        for (const child of node.children ?? []) inspect(child);
    };
    inspect(document.root);
    for (const source of document.sources) for (const key of [...references(source.type), "unit"]) if (typeof source.props[key] === "string") placeholders.delete(source.props[key] as string);
    const removed = new Set(Array.from(placeholders).filter(name => candidates.has(name)));
    const clear = (node: PresetNode): void => { if (node.type === "foreach" && node.source !== undefined && removed.has(node.source)) { delete node.source; delete node.sourcePath; } for (const child of node.children ?? []) clear(child); };
    clear(document.root); document.sources = document.sources.filter(source => !removed.has(source.name));
    const generated: PresetDocument[] = [];
    const specs = new Map(document.sources.map(source => [source.name, source]));
    const moved = new Set<string>();
    const referenced = new Set<string>();
    const originalReferences = (node: PresetNode): void => { for (const name of nodeSources(node)) referenced.add(name); for (const child of node.children ?? []) originalReferences(child); };
    originalReferences(document.root);
    const dependencies = (name: string): void => { const spec = specs.get(name); if (spec !== undefined && !spec.isProp) for (const key of references(spec.type)) { const dependency = spec.props[key] as string; if (!referenced.has(dependency)) { referenced.add(dependency); dependencies(dependency); } } };
    for (const name of Array.from(referenced)) dependencies(name);
    const visit = (node: PresetNode): void => {
        if (node.type !== "foreach") { for (const child of node.children ?? []) visit(child); return; }
        // Extract the innermost iterators first, while their literal unit context is intact.
        for (const template of node.children ?? []) visit(template);
        node.children = (node.children ?? []).map((template, index) => {
            if (template.type === "preset") return template;
            let id = (document.id + "-" + node.id + "-template-" + (index + 1)).slice(0, 85), suffix = 1;
            const base = id; while (occupied.has(id)) id = base + "-" + suffix++;
            occupied.add(id);
            const root = copy(template) as unknown as PresetNode;
            const sources = new Map<string, SourceSpec>(), sourceProps: Record<string, string> = {};
            const visiting = new Set<string>();
            const scoped = (name: string, seen = new Set<string>()): boolean => {
                if (seen.has(name)) fail("cyclic source dependency: " + name); seen.add(name);
                const spec = specs.get(name);
                const result = spec !== undefined && !spec.isProp && (spec.props.unit === "$unit" || spec.props.unit === "$pet" || references(spec.type).some(key => scoped(spec.props[key] as string, new Set(seen))));
                return result;
            };
            const add = (name: string): void => {
                if (sources.has(name)) return;
                if (visiting.has(name)) fail("cyclic source dependency: " + name); visiting.add(name);
                if (name === "item") {
                    sources.set(name, { name, type: "repeatItem", props: {}, isProp: true }); sourceProps[name] = "parent.$item";
                } else {
                    const original = specs.get(name); if (original === undefined) fail("missing legacy template source: " + name);
                    if (scoped(name)) {
                        const spec = copy(original) as unknown as SourceSpec;
                        sources.set(name, spec); moved.add(name);
                        for (const key of references(spec.type)) add(spec.props[key] as string);
                        if (spec.props.unit === "$unit" || spec.props.unit === "$pet") spec.props.unit = unitInput(spec.props.unit);
                    } else {
                        sources.set(name, { name, type: original.type, props: {}, isProp: true, ...(original.optional ? { optional: true } : {}) }); sourceProps[name] = name;
                    }
                }
                visiting.delete(name);
            };
            const unitInput = (token: string): string => {
                const desired = token === "$unit" ? "NamedUnitSource" : "NamedPetSource";
                let name = desired, suffix = 1;
                while (specs.has(name) || sources.has(name) && sourceProps[name] !== "parent." + token) name = desired + suffix++;
                sources.set(name, { name, type: "unit", props: {}, isProp: true }); sourceProps[name] = "parent." + token; return name;
            };
            const rewrite = (current: PresetNode): void => {
                for (const name of nodeSources(current)) if (name !== undefined) add(name);
                for (const key of ["unit", "powerColorUnit"]) if (current.props[key] === "$unit" || current.props[key] === "$pet") current.props[key] = unitInput(current.props[key] as string);
                for (const child of current.children ?? []) rewrite(child);
            };
            rewrite(root);
            // Preserve unused legacy unit definitions in the first visible template, lazily.
            if (index === 0) for (const spec of document.sources) if (!referenced.has(spec.name) && !moved.has(spec.name) && scoped(spec.name)) add(spec.name);
            const child: PresetDocument = { version: 1, kind: "preset", id, name: (document.name + " / " + (template.name ?? node.name ?? node.id) + " " + (index + 1)).slice(0, 128), sources: Array.from(sources.values()), root };
            // Reuse an imported template identity only when the complete definition is identical.
            const same = (a: unknown, b: unknown): boolean => {
                if (a === b) return true;
                if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
                const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
                return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => same(left[key], right[key]));
            };
            const previous = existing.get(base);
            if (previous !== undefined && same({ ...child, id: base }, previous)) { id = base; child.id = base; }
            generated.push(child);
            return { id: template.id, ...(template.name === undefined ? {} : { name: template.name }), type: "preset", preset: id, props: {}, sourceProps };
        });
    };
    visit(document.root);
    const used = new Set<string>();
    const keep = (name: string): void => { if (used.has(name)) return; used.add(name); const spec = specs.get(name); if (spec !== undefined && !spec.isProp) for (const key of references(spec.type)) keep(spec.props[key] as string); };
    const scan = (node: PresetNode): void => { for (const name of nodeSources(node)) if (name !== undefined) keep(name); for (const child of node.children ?? []) scan(child); };
    scan(document.root);
    for (const spec of document.sources) if (!moved.has(spec.name) && !spec.isProp) for (const key of references(spec.type)) keep(spec.props[key] as string);
    document.sources = document.sources.filter(spec => !moved.has(spec.name) || used.has(spec.name));
    return generated;
}
