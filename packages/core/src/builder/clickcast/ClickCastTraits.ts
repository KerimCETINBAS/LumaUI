import type { ClickCastTraits, ClickCastTargeting } from "../../core/builder";
import { fail, keys, record } from "../validate";

/** Missing traits retain the behavior of existing saved presets. */
export function clickCastTraits(value?: unknown): ClickCastTraits {
    const input = value === undefined ? {} : record(value);
    keys(input, ["onlyTarget", "friendly", "enemy", "nodead", "clearTargeting"]);
    for (const key of ["onlyTarget", "friendly", "enemy", "nodead", "clearTargeting"])
        if (input[key] !== undefined && (issecretvalue(input[key]) || typeof input[key] !== "boolean")) fail("Click Cast " + key + " must be a checkbox value");
    const traits = { onlyTarget: input.onlyTarget === true, friendly: input.friendly !== false, enemy: input.enemy !== false, nodead: input.nodead === true, clearTargeting: input.clearTargeting !== false };
    if (!traits.friendly && !traits.enemy) fail("Allow friendly units, enemy units, or both");
    return traits;
}
export function clickCastTargeting(value: unknown, traits: ClickCastTraits): ClickCastTargeting {
    if (value !== undefined && value !== "direct" && value !== "mouseover") fail("Choose Direct secure action or Mouseover macro");
    return value as ClickCastTargeting | undefined ?? (traits.onlyTarget ? "mouseover" : "direct");
}
