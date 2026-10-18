import { Background, Border } from "wuira/ui";
import type { CellProps } from "wuira/ui";
import type { Properties, PropertyRules } from "../../core/builder";

const anchors = ["TOPLEFT", "TOP", "TOPRIGHT", "LEFT", "CENTER", "RIGHT", "BOTTOMLEFT", "BOTTOM", "BOTTOMRIGHT"];

export const common: PropertyRules = {
    width: { type: "size" }, height: { type: "size" }, margin: { type: "spacing" }, padding: { type: "spacing" },
    mode: { type: "string", values: ["absolute", "relative"] }, anchor: { type: "string", values: anchors },
    relativeAnchor: { type: "string", values: anchors }, relativeTo: { type: "string" }, x: { type: "number" }, y: { type: "number" }, offset: { type: "offset" },
    alpha: { type: "number", min: 0, max: 1 }, condition: { type: "boolean" }, clickThrough: { type: "boolean" },
    backgroundColor: { type: "color" }, borderColor: { type: "color" }, borderWidth: { type: "number", min: 0, max: 64 },
};

export const positive = { type: "number", min: 1, max: 10000000 } as const;
export const unit: PropertyRules = { unit: { type: "string" } };
/** Authored resting values. Preview draws these; simulation may change them afterward. */
export const reading: PropertyRules = {
    initial: { type: "number", min: 0, max: 1000000000 },
    maximum: { type: "number", min: 0, max: 1000000000 },
};

export function visual(input: Properties): Partial<CellProps> {
    const { backgroundColor, borderColor, borderWidth, ...rest } = input;
    const props = rest as Partial<CellProps>;
    if (backgroundColor !== undefined || borderColor !== undefined) props.decorations = {
        background: backgroundColor === undefined ? undefined : new Background({ color: backgroundColor as unknown as { r: number; g: number; b: number; a?: number } }),
        border: borderColor === undefined ? undefined : new Border({ color: borderColor as unknown as { r: number; g: number; b: number; a?: number }, thickness: borderWidth as number | undefined ?? 1 }),
    };
    return props;
}
