import type { PresetDocument, PresetNode, Properties, SourceSpec } from "../../core/builder";
import { array, copy, fail, identifier, keys, properties, record, text } from "../validate";
import { validateActivation } from "./Activation";
import { migrateRepeats } from "./RepeatMigration";
import { migrateClassColors } from "./ClassColorMigration";
import { migrateNativeVisibility } from "./NativeVisibilityMigration";
import { migrateSections } from "./sectionMigration";
import { initialProperties } from "./previewFixtures";
import { propertyBindingTargets } from "../converters/PropertyBindings";
import { validateValuePath } from "../converters/ConverterSources";
import { literalUnit, referenceDocument, releaseRetiredOwner, repeatReference, typeNotPreset } from "./presetModel";
import type { Presets } from "./Presets";
export function validateDocument(host: Presets, input: unknown, allowMissing = false, libraryOverride?: PresetDocument[]): PresetDocument  {
        const data = record(copy(input));
        const available = new Map<string, PresetDocument>();
        const occupied = new Set([...(libraryOverride ?? host.List()).map(doc => doc.id)]);
        const reserve = (doc: PresetDocument): void => { occupied.add(doc.id); for (const dependency of doc.dependencies ?? []) reserve(dependency); };
        reserve(data as unknown as PresetDocument);
        const collect = (value: unknown, depth: number) => {
            if (depth > 16 || available.size >= 64) fail("too many component dependencies");
            const doc = record(value);
            keys(doc, ["version", "kind", "id", "name", "owner", "sources", "root", "dependencies", "enabled", "class", "condition", "layout", "layoutPositions"]);
            validateActivation(doc);
            if (doc.kind !== "preset" || doc.version !== 1) fail("unsupported component version or kind");
            const id = identifier(doc.id); text(doc.name, "component name"); if (doc.owner !== undefined) identifier(doc.owner);
            releaseRetiredOwner(doc);
            array(doc.sources, 128); migrateClassColors(doc as unknown as PresetDocument); migrateNativeVisibility(doc as unknown as PresetDocument);
            if (available.has(id)) fail("duplicate component dependency: " + id);
            available.set(id, doc as unknown as PresetDocument);
            for (const dependency of doc.dependencies === undefined ? [] : array(doc.dependencies, 64)) collect(dependency, depth + 1);
            delete doc.dependencies;
            for (const generated of migrateRepeats(doc as unknown as PresetDocument, type => host.SourceReferences(type), occupied, new Map((libraryOverride ?? host.List()).map(doc => [doc.id, doc])))) {
                if (available.has(generated.id)) fail("duplicate migrated component: " + generated.id);
                available.set(generated.id, generated);
            }
        };
        collect(data, 0);
        const local = new Map((libraryOverride ?? host.List()).map(doc => [doc.id, doc]));
        const stack = new Set<string>(); const dependencies = new Map<string, PresetDocument>();
        let nodeCount = 0, sourceCount = 0;
        const validate = (doc: PresetDocument, depth: number, dynamic = false): number => {
            if (depth > 16 || stack.has(doc.id)) fail("cyclic component dependency: " + doc.id);
            migrateSections(doc);
            stack.add(doc.id);
            const names = new Set<string>();
            for (const entry of array(doc.sources, 128)) {
                if (++sourceCount > 512) fail("too many composed sources");
                const spec = record(entry); keys(spec, ["name", "type", "props", "isProp", "optional"]);
                for (const field of ["isProp", "optional"]) if (spec[field] !== undefined && typeof spec[field] !== "boolean") fail("invalid source input flag");
                if (spec.optional === true && spec.isProp !== true) fail("only exposed source inputs can be optional");
                const name = identifier(spec.name), type = identifier(spec.type);
                if (type === "repeatItem" && spec.isProp !== true) fail("Repeat item is an input; connect it in the parent reference Data tab");
                if (name === "item" && spec.isProp !== true) fail("item is reserved for the current ForEach item");
                if (names.has(name)) fail("duplicate source: " + name); names.add(name);
                const source = host.sources.get(type); if (source === undefined) fail("source addon is unavailable: " + type);
                if (spec.isProp === true) { properties(spec.props, initialProperties(type)); } else { properties(spec.props, source.properties); source.Validate?.(spec.props as Properties); }
            }
            for (const entry of doc.sources.filter(spec => !spec.isProp)) for (const field of host.sources.get(entry.type)!.references ?? [])
                if (!names.has(identifier(entry.props[field])) && !allowMissing) fail("missing source dependency: " + entry.props[field]);
            const specsByName = new Map(doc.sources.map(spec => [spec.name, spec]));
            const sourceDependencies = (spec: SourceSpec): string[] => [...host.SourceReferences(spec.type).map(key => spec.props[key] as string), ...(typeof spec.props.unit === "string" && names.has(spec.props.unit) ? [spec.props.unit] : [])];
            const checkUnit = (value: unknown, ambient = false): void => {
                if (typeof value !== "string") return;
                const spec = specsByName.get(value);
                if (spec !== undefined) { if (!host.SourcesCompatible(spec.type, "unit") && !allowMissing) fail("unit reference requires UnitSource: " + value); return; }
                if (value === "$unit" || value === "$pet") return;
                if (!allowMissing && !literalUnit(value)) fail("missing named UnitSource or unsupported context: " + value);
            };
            for (const spec of doc.sources) if (!spec.isProp) checkUnit(spec.props.unit, dynamic);
            const visitingSources = new Set<string>(), visitedSources = new Set<string>();
            const visitSource = (name: string) => {
                if (visitingSources.has(name)) fail("cyclic source dependency: " + name);
                if (visitedSources.has(name)) return;
                visitingSources.add(name); const spec = specsByName.get(name);
                if (spec !== undefined && !spec.isProp) for (const dependency of sourceDependencies(spec)) visitSource(dependency);
                visitingSources.delete(name); visitedSources.add(name);
            };
            for (const name of names) visitSource(name);
            const ids = new Set<string>(); const drawable = new Set<string>();
            const visit = (inputNode: unknown, level: number, insideGroup = false, insideDynamic = dynamic, repeatItem = false, repeatName?: string, repeatCollection?: string): number => {
                if (level > 32 || ++nodeCount > 256) fail("component tree is too large");
                const node = record(inputNode);
                keys(node, ["id", "name", "type", "props", "source", "sourcePath", "visibleSource", "visiblePath", "visibleWhen", "textSource", "alphaSource", "children", "preset", "items", "bindings", "activation", "sourceProps", "sections"]);
                if (typeNotPreset(node) && (node.activation !== undefined || node.sourceProps !== undefined)) fail("only component references accept activation and source inputs");
                if (node.name !== undefined) text(node.name, "element name", 96);
                const id = identifier(node.id); if (ids.has(id)) fail("duplicate node ID: " + id); ids.add(id);
                const type = identifier(node.type);
                const children = node.children === undefined ? [] : array(node.children);
                if (node.items !== undefined) { if (type !== "foreach") fail("only ForEach accepts an items expression"); host.ParseItems(text(node.items, "items expression", 4096)); }
                if (type === "preset" || type === "fragment") {
                    properties(node.props, type === "preset" ? host.ComponentProperties("cell") : {});
                    if (node.bindings !== undefined) fail("bind properties inside the referenced component");
                    for (const field of ["source", "sourcePath", "visibleSource", "visiblePath", "visibleWhen", "textSource", "alphaSource"])
                        if (node[field] !== undefined) fail("bind sources inside the referenced component");
                    if (type === "fragment") {
                        if (node.preset !== undefined) fail("only component nodes accept a component reference");
                        let total = 0; for (const child of children) total += visit(child, level + 1, insideGroup, insideDynamic); return total;
                    }
                    if (children.length > 0) fail("edit children in the referenced component");
                    const dependencyId = identifier(node.preset);
                    const dependency = available.get(dependencyId) ?? local.get(dependencyId);
                    if (dependency === undefined) { if (allowMissing) { drawable.add(id); return 1; } fail("missing component dependency: " + dependencyId); }
                    if (node.activation !== undefined) { const override = record(node.activation); keys(override, ["enabled", "class", "condition", "layout"]); validateActivation(referenceDocument(dependency, node as unknown as PresetNode) as unknown as Record<string, unknown>); }
                    if (node.sourceProps !== undefined) for (const [input, parentSource] of Object.entries(record(node.sourceProps))) {
                        identifier(input);
                        const reference = text(parentSource, "source input reference", 196);
                        const contextual = repeatReference(reference); if (contextual === undefined) identifier(reference);
                        const target = dependency.sources.find(spec => spec.name === input && spec.isProp);
                        if (target === undefined) { if (allowMissing) continue; fail("component does not expose source: " + input); }
                        if (contextual !== undefined) {
                            if (repeatItem && (contextual.owner === "parent" || contextual.owner === repeatName) && host.RepeatSourceCompatible(repeatCollection, contextual.field, target.type)) continue;
                            if (!allowMissing) fail("unsupported or incompatible Repeat context for input: " + input + " = " + parentSource);
                            continue;
                        }
                        const supplied = specsByName.get(identifier(parentSource));
                        if ((supplied === undefined || !host.SourcesCompatible(supplied.type, target.type)) && !allowMissing) fail("source input type mismatch or missing reference: " + input);
                    }
                    dependencies.set(dependencyId, dependency);
                    const count = validate(dependency, depth + 1, insideDynamic); if (count > 0) drawable.add(id); return count;
                }
                if (node.preset !== undefined) fail("only component nodes accept a component reference");
                const component = host.components.get(type);
                if (component === undefined) fail("component addon is unavailable: " + type);
                properties(node.props, component.properties);
                component.Validate?.(node.props as Properties);
                if (type !== "hideUnitFrame") checkUnit((node.props as Properties).unit, insideDynamic);
                checkUnit((node.props as Properties).powerColorUnit, insideDynamic);
                if (insideDynamic && (type === "secureButton" || component.headless === true)) fail("dynamic nameplate templates cannot contain secure controls or headless effects");
                const deferred = component.headless === true && component.deferred === true;
                if (deferred) {
                    if (insideGroup) fail("register dynamic nameplate rules outside repeated item templates");
                    const filter = (node.props as Properties).filter;
                    if (!allowMissing && (typeof filter !== "string" || !names.has(filter))) fail("BlizzardElement filter requires a named unit converter source");
                    if ((node.props as Properties).replace === true ? children.length !== 1 : children.length !== 0) fail("Replace needs one visual template; Apply has no replacement children");
                }
                if (type === "unitAuras") for (const key of ["maxIcons", "iconSize"]) if (node.props !== undefined && (node.props as Properties)[key] !== undefined && !Number.isInteger((node.props as Properties)[key])) fail("aura slot sizes and counts must be integers");
                if (type === "foreach" && children.some(child => record(child).type !== "preset")) fail("Repeat templates must be component references");
                if (type === "foreach" && (children.length < 1 || children.length > 2 || (node.source !== undefined && node.items !== undefined))) fail("ForEach accepts one list source or helper expression and requires one item template (an optional second template is for pets)");
                if (type === "foreach" && (node.props as Properties).wrapAfter !== undefined && !Number.isInteger((node.props as Properties).wrapAfter)) fail("ForEach wrapAfter must be an integer");
                if (node.source !== undefined) {
                    const name = identifier(node.source); if (!allowMissing && (!names.has(name) && !(name === "item" && insideGroup))) fail("missing source or ForEach item scope: " + name);
                    if (component.source === undefined) fail("component does not accept a source: " + type);
                }
                if (node.sourcePath !== undefined) {
                    if (node.source === undefined && node.textSource === undefined) fail("sourcePath requires a source");
                    if (node.source === undefined) validateValuePath(text(node.sourcePath, "source path", 128));
                    else for (const part of text(node.sourcePath, "source path", 128).split(".")) {
                        identifier(part); if (["__proto__", "prototype", "constructor"].includes(part)) fail("invalid source path");
                    }
                }
                if (node.visiblePath !== undefined) {
                    if (node.visibleSource === undefined) fail("visiblePath requires a visibility source");
                    validateValuePath(text(node.visiblePath, "visibility path", 128));
                }
                if (node.visibleWhen !== undefined) {
                    if (node.visibleSource === undefined) fail("visibleWhen requires a visibility source");
                    if (node.visibleWhen !== "true" && node.visibleWhen !== "false") fail("invalid visibility match");
                }
                for (const field of ["visibleSource", "textSource", "alphaSource"]) if (node[field] !== undefined) {
                    const name = identifier(node[field]);
                    if (!allowMissing && !names.has(name) && !(name === "item" && insideGroup)) fail("missing binding source or ForEach item scope");
                }
                if (component.headless === true && ["visibleSource", "textSource", "alphaSource"].some(field => node[field] !== undefined))
                    fail("headless effects do not have visual bindings");
                if (node.sections !== undefined) for (const section of array(node.sections, 16)) {
                    const item = record(section); keys(item, ["source", "key", "color", "texture"]);
                    const sectionSource = identifier(item.source); text(item.key, "section key", 64);
                    if (item.texture !== undefined) text(item.texture, "overlay texture", 260);
                    if (!allowMissing && !names.has(sectionSource)) fail("missing section source: " + sectionSource);
                }
                if (node.bindings !== undefined) {
                    if (component.headless === true) fail("headless effects cannot have property bindings");
                    const bindings = record(node.bindings);
                    for (const [target, input] of Object.entries(bindings)) {
                        if (!propertyBindingTargets.includes(target as never) || component.properties[target] === undefined || target === "color" && type !== "progress") fail("unsupported property binding: " + target);
                        const binding = record(input); keys(binding, ["source", "path"]);
                        const bindingSource = identifier(binding.source);
                        if (!allowMissing && !names.has(bindingSource)) fail("missing property binding source: " + bindingSource + " in " + doc.id);
                        if (binding.path !== undefined) validateValuePath(text(binding.path, "binding path", 128));
                    }
                }

                const collectionType = node.items === undefined ? specsByName.get(node.source as string)?.type ?? "" : host.ParseItems(node.items as string).type;
                const repeatedItem = type === "foreach" && (collectionType === "" || host.SourcesCompatible(collectionType, "list"));
                let total = 0; for (const child of children) total += visit(child, level + 1, insideGroup || type === "foreach", insideDynamic || deferred, repeatedItem, type === "foreach" ? node.name as string | undefined ?? (id === doc.root.id ? doc.name : undefined) : undefined, collectionType === "" ? undefined : collectionType);
                if (deferred && (node.props as Properties).replace === true && total !== 1) fail("Replace needs one visual template");
                if ((component.children === "none" && children.length > 0) || (component.children === "single" && total > 1)) fail("invalid child count for " + type);
                if (component.headless === true) return 0;
                drawable.add(id); return 1;
            };
            const count = visit(doc.root, 0); if (count > 1) fail("wrap visual roots in a layout");
            const references = (node: PresetNode) => {
                if (node.props.relativeTo !== undefined && !drawable.has(identifier(node.props.relativeTo))) fail("missing relativeTo node");
                for (const child of node.children ?? []) references(child);
            };
            references(doc.root); stack.delete(doc.id); return count;
        };
        validate(data as unknown as PresetDocument, 0);
        for (const id of available.keys()) if (id !== data.id && !dependencies.has(id)) fail("unused component dependency: " + id);
        const result = data as unknown as PresetDocument;
        if (dependencies.size > 0) result.dependencies = Array.from(dependencies.values());
        return result;

}
