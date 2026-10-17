import { Background, Border } from "wuira/ui";
import type { Cell } from "wuira";
import type { CellProps } from "wuira/ui";
type Color = ConstructorParameters<typeof Border>[0]["color"];
import type { PresetNode, Properties, SourceInstance } from "../core/builder";
import { sourceValue } from "./ConverterSources";
import { properties, fail } from "./validate";

export const propertyBindingTargets = ["backgroundColor", "borderColor", "color", "alpha"] as const;
/** Property sinks change only appearance, without changing protected units or actions. */
export function preparePropertyBindings(node: PresetNode, input: Properties, source: (name: string) => SourceInstance, own: (() => void)[]): (view: Cell) => void {
    const bindings = Object.entries(node.bindings ?? {}).map(([target, binding]) => {
        const value = sourceValue(source(binding.source), binding.path);
        own.push(() => value.Dispose());
        const fallback = node.props[target];
        const read = () => {
            if (value.IsSecret()) return fallback;
            const result = value.Value ?? fallback;
            if (result !== undefined) properties({ value: result as never }, { value: target === "alpha" ? { type: "number", min: 0, max: 1 } : { type: "color" } });
            return result;
        };
        const initial = read();
        input[target] = (initial as Properties[string] | undefined) ?? (target === "alpha" ? 1 : { r: 0, g: 0, b: 0, a: 0 });
        return { target, value, read };
    });
    return view => {
        if (bindings.length === 0) return;
        const props = view.props as CellProps;
        if (bindings.some(binding => binding.target === "color") && view.kind !== "progress") fail("color source binding currently requires a progress bar");
        const previous = props.onMount;
        props.onMount = frame => {
            const cleanup = previous?.(frame), stops: (() => void)[] = [];
            try {
                for (const binding of bindings) {
                    const apply = () => {
                        const value = binding.read();
                        if (binding.target === "alpha") { frame.SetAlpha(value as number | undefined ?? 1); return; }
                        const color = value as Color | undefined ?? { r: 0, g: 0, b: 0, a: 0 };
                        if (binding.target === "color") { (frame as wuiraNativeStatusBar).SetStatusBarColor(color.r, color.g, color.b, color.a ?? 1); return; }
                        const decoration = binding.target === "backgroundColor" ? props.decorations?.background : props.decorations?.border;
                        if (!(decoration instanceof Background) && !(decoration instanceof Border)) fail("color binding requires a background or border decoration");
                        decoration.props.color = color;
                        decoration.dispose(); decoration.mount(frame, frame.GetWidth(), frame.GetHeight());
                    };
                    apply(); stops.push(binding.value.onChange(apply));
                }
            } catch (failure) { for (const stop of stops) stop(); cleanup?.(); throw failure; }
            return () => { for (const stop of stops) stop(); cleanup?.(); };
        };
    };
}
