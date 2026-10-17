import type { Properties } from "../core/builder";
import { array, record, fail } from "./validate";
/** Static records use the same keyed collection boundary as reactive list factories. */
export function listRecords(props: Properties): object[] {
    const used = new Set<string | number>();
    return array(props.items ?? [], 512).map(value => {
        const item = record(value), key = item.key;
        if (issecretvalue(key) || (typeof key !== "string" && typeof key !== "number") || key === "" || (typeof key === "number" && !Number.isFinite(key))) fail("List records need a string or numeric key");
        if (used.has(key as string | number)) fail("Duplicate list record key: " + key);
        used.add(key as string | number);
        return item;
    });
}
