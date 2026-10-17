import { Nameplates, UI } from "wuira";
import type { Cell } from "wuira";
import type { NameplateContext, NameplateRender, NameplateSelector } from "wuira/skins";
import type { BlizzardElementProps, NativePlateStyle, Properties, PropertyRules, SkinInstance } from "../core/builder";
import { fail, properties } from "./validate";

export const blizzardElementProperties: PropertyRules = {
    type: { type: "string", required: true, values: ["dynamic"] },
    target: { type: "string", required: true, values: ["nameplate"] },
    filter: { type: "string", required: true }, replace: { type: "boolean" }, apply: { type: "boolean" },
    width: { type: "number", min: 0, max: 8192 }, height: { type: "number", min: 0, max: 8192 },
    scale: { type: "number", min: 0.01, max: 10 }, alpha: { type: "number", min: 0, max: 1 },
    healthColor: { type: "color" }, castColor: { type: "color" },
};
export function validateBlizzardElement(props: Properties): void {
    if ((props.replace === true) === (props.apply === true)) fail("BlizzardElement requires exactly one of replace or apply");
    if (props.replace === true && ["width", "height", "scale", "alpha", "healthColor", "castColor"].some(key => props[key] !== undefined))
        fail("style the replacement template; native style properties require apply");
}
function style(plate: NameplateContext, props: NativePlateStyle): void {
    const { healthBar, castBar } = plate.Native;
    if (props.alpha !== undefined) plate.Alpha(plate.Native, props.alpha);
    if (props.scale !== undefined) plate.Scale(plate.Native, props.scale);
    if (healthBar !== undefined && (props.width !== undefined || props.height !== undefined))
        plate.Size(healthBar, props.width ?? healthBar.GetWidth(), props.height ?? healthBar.GetHeight());
    for (const [bar, color] of [[healthBar, props.healthColor], [castBar, props.castColor]] as const)
        if (bar !== undefined && color !== undefined) plate.BarColor(bar, color.r, color.g, color.b, color.a ?? 1);
}
/** Shared registration path for JSX and document factories. Each call owns one rule group. */
export function registerBlizzardElement(props: BlizzardElementProps, child?: NameplateRender): SkinInstance {
    const { filter, child: template, ...data } = props;
    properties({ ...data, filter: "predicate" }, blizzardElementProperties);
    validateBlizzardElement(data as unknown as Properties);
    if (typeof filter !== "function") fail("BlizzardElement requires a unit-to-boolean predicate");
    const render = template ?? child;
    if (props.replace === true && typeof render !== "function") fail("Replace requires a per-unit child factory");
    if (props.apply === true && render !== undefined) fail("Apply reuses native visuals and cannot have a replacement child");
    const selector: NameplateSelector = plate => {
        const value = filter(plate.Unit);
        if (issecretvalue(value)) return false;
        if (typeof value !== "boolean") fail("unit converter must return a boolean");
        return value;
    };
    return props.replace === true ? Nameplates.Replace(selector, render!) : Nameplates.Apply(selector, plate => style(plate, props));
}
/** The zero-size host owns registration only; the factory is invoked afresh by Wuira. */
export function BlizzardElement(props: BlizzardElementProps, child?: NameplateRender): Cell {
    return UI.createElement("cell", { width: 0, height: 0, clickThrough: true,
        onMount: () => { const handle = registerBlizzardElement(props, child); return () => handle.Dispose(); } });
}
