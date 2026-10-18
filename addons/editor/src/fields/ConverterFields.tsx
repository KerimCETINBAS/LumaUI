import { UI } from "wuira/ui";
import { FlowLayout, Label } from "wuira/ui";
import type { SourceEditor } from "../property/SourceEditor";
import { Field, Toggle, ColorFields, Action, Heading, Note } from "./InspectorControls";
import { Dropdown } from "./Dropdown";
import { formatOutput } from "../property/ConverterForm";

export function OutputFields({ state, prefix, title, width, optional = false }: { state: SourceEditor; prefix: string; title: string; width: number; optional?: boolean }) {
    const type = state.values[prefix + ".type"] ?? "none";
    const kinds = [...(optional ? [{ label: "No default", value: "none" }] : []), { label: "Color (RGBA)", value: "color" }, { label: "Number", value: "number" }, { label: "Text", value: "string" }, { label: "Boolean", value: "boolean" }];
    return <FlowLayout width={width} height={type === "color" ? 142 : type === "none" ? 48 : 116} gap={4}>
        <Label width={width} height={17} text={title} fontSize={10} />
        <Dropdown width={width} text={kinds.find(kind => kind.value === type)?.label ?? "Imported data"} options={kinds} onSelect={value => {
            state.Flush();
            if (value === "color") formatOutput(state.values, prefix, { r: 1, g: 1, b: 1, a: 1 });
            else state.values[prefix + ".text"] = value === "boolean" ? "true" : value === "number" ? "0" : "";
            state.Set(prefix + ".type", value);
        }} />
        {type === "color" ? <ColorFields state={state} name={prefix} title="Output color" width={width} />
            : type === "none" ? []
            : type === "data" ? <Note width={width} text="Imported structured output is preserved. Choose a type to replace it." />
            : type === "boolean" ? <Field state={state} name={prefix + ".text"} title="Output value" width={width} rule={{ type: "string", values: ["true", "false"] }} />
            : <Field state={state} name={prefix + ".text"} title="Output value" width={width} rule={{ type: type === "number" ? "number" : "string" }} />}
    </FlowLayout>;
}
export function CaseFields({ state, width }: { state: SourceEditor; width: number }) {
    const count = Number(state.values["cases.count"] ?? "0");
    return <FlowLayout width={width} height={0} sizing="content" gap={10}>
        <Heading width={width} text="Match input → output" />
        <Note width={width} text="Cases use strict equality. Class tokens include PALADIN, MAGE and PRIEST." />
        {Array.from({ length: count }, (_, index) => {
            const prefix = "cases." + index, type = state.values[prefix + ".matchType"] ?? "string";
            return <FlowLayout width={width} height={0} sizing="content" gap={5}>
                <FlowLayout width={width} height={28} direction="horizontal" gap={4}>
                    <Label width={width - 82} height={28} text={"Case " + (index + 1) + " · equals (==)"} fontSize={11} />
                    <Action width={78} text="Remove" onClick={() => state.RemoveCase(index)} />
                </FlowLayout>
                <Dropdown width={width} text={type === "string" ? "Match text" : type === "number" ? "Match number" : "Match boolean"}
                    options={[{ label: "Match text", value: "string" }, { label: "Match number", value: "number" }, { label: "Match boolean", value: "boolean" }]} onSelect={value => state.Set(prefix + ".matchType", value)} />
                <Field state={state} name={prefix + ".equals"} title="Input equals" width={width} rule={type === "boolean" ? { type: "string", values: ["true", "false"] } : { type: type === "number" ? "number" : "string" }} />
                <OutputFields state={state} prefix={prefix + ".output"} title="Return" width={width} />
            </FlowLayout>;
        })}
        <Action width={width} text="+ Add case" onClick={() => state.AddCase()} />
    </FlowLayout>;
}
