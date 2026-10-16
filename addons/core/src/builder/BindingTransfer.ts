import type { CollectionKeybinding, PresetDocument, PresetNode } from "../core/builder";
import { array, copy, fail, identifier, keys, record, text } from "./validate";

/** Transfer records reference secure nodes; no assignment is stored in a node's props. */
export function validateAssignments(document: PresetDocument, input: unknown): CollectionKeybinding[] {
    const targets = new Map<string, Set<string>>();
    for (const entry of [document, ...document.dependencies ?? []]) {
        const nodes = new Set<string>();
        const visit = (node: PresetNode) => {
            if (node.type === "secureButton") nodes.add(node.id);
            for (const child of node.children ?? []) visit(child);
        };
        visit(entry.root); targets.set(entry.id, nodes);
    }
    const assignedKeys = new Set<string>(), assignedNodes = new Set<string>();
    return array(copy(input), 1024).map(value => {
        const entry = record(value); keys(entry, ["collection", "node", "key"]);
        const collection = identifier(entry.collection), node = identifier(entry.node);
        const key = text(entry.key, "keybinding", 128);
        if (key.trim() !== key || key.trim().length === 0) fail("invalid keybinding");
        if (!targets.get(collection)?.has(node)) fail("keybinding references a missing secure button");
        const target = collection + "/" + node;
        if (assignedKeys.has(key) || assignedNodes.has(target)) fail("duplicate transferred keybinding");
        assignedKeys.add(key); assignedNodes.add(target);
        return { collection, node, key };
    });
}
