import { UI } from "wuira/ui";
import { Cell, FlowLayout, Label } from "wuira/ui";
import type { PropertyRule } from "lumaui/core";
import type { FormState } from "./InspectorControls";
import { ArrayInput } from "./ArrayInput";
import { searchSpells, spellChoice } from "../catalogs/SpellCatalog";
import { Core } from "../core";
/** The form keeps its existing numeric representation; search text never becomes a property. */
export function SpellField({ state, name, title, rule, width }: { state: FormState; name: string; title: string; rule: PropertyRule; width: number }) {
    const single = rule.type !== "numbers";
    let raw = state.values[name] ?? "";
    const values = raw.trim() === "" || raw.trim() === "[]" ? [] : single ? [raw.trim()] : raw.split(",").map(value => value.trim());
    const height = single ? 106 : 186;
    return <FlowLayout width={width} height={height} gap={3}>
        <Label width={width} height={17} text={title + (rule.required ? " *" : "")} fontSize={10} color={Core.Theme.colors.text} />
        <Cell width={width} height={height - 20} onMount={() => state.Capture(name, () => raw)}>
            <ArrayInput width={width} values={values} single={single} describe={spellChoice} placeholder="Search spell names"
                provider={selected => ({ Search: query => searchSpells(query, selected) })}
                onChange={next => { raw = single ? next[0] ?? "" : next.length === 0 ? "[]" : next.join(", "); state.Flush(); state.values[name] = raw; }} />
        </Cell>
    </FlowLayout>;
}
