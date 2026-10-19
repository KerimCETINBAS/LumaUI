export type PrimitiveGroup = "Layout" | "Data" | "Visuals" | "Effects";

export type InputKind =
  | "text"
  | "number"
  | "size"
  | "toggle"
  | "choice"
  | "color"
  | "anchor"
  | "offset"
  | "spacing"
  | "texture"
  | "search"
  | "unit"
  | "list"
  | "keybind"
  | "part";

export interface PrimitiveField {
  kind: InputKind;
  label: string;
  hint?: string;
  options?: string[];
  value?: string;
}

export interface PrimitiveSpec {
  id: string;
  group: PrimitiveGroup;
  name: string;
  summary: string;
  fields: PrimitiveField[];
}

export const groups: PrimitiveGroup[] = ["Layout", "Data", "Visuals", "Effects"];

export const primitives: PrimitiveSpec[] = [
  {
    id: "cell",
    group: "Layout",
    name: "Cell",
    summary: "One box. It holds a single child and can sit in a flow, a grid, or a region.",
    fields: [
      { kind: "size", label: "Width", value: "140" },
      { kind: "size", label: "Height", value: "40" },
      { kind: "anchor", label: "Anchor" },
      { kind: "offset", label: "Offset" },
    ],
  },
  {
    id: "flow",
    group: "Layout",
    name: "Flow",
    summary: "Children in a row or a column. Spacing and alignment belong to the line.",
    fields: [
      { kind: "choice", label: "Direction", options: ["Left to right", "Right to left", "Top to bottom", "Bottom to top"], value: "Top to bottom" },
      { kind: "number", label: "Column gap", value: "4" },
      { kind: "number", label: "Row gap", value: "4" },
      { kind: "choice", label: "Align", options: ["Start", "Center", "End"], value: "Start" },
    ],
  },
  {
    id: "grid",
    group: "Layout",
    name: "Grid",
    summary: "Children in columns. Each cell has its own width and height.",
    fields: [
      { kind: "number", label: "Columns", value: "2" },
      { kind: "number", label: "Cell width", value: "64" },
      { kind: "number", label: "Cell height", value: "24" },
      { kind: "number", label: "Gap", value: "4" },
    ],
  },
  {
    id: "each",
    group: "Layout",
    name: "Each",
    summary: "One copy per item. The copies are arranged as a flow or a grid. The item is whatever the list holds.",
    fields: [
      { kind: "list", label: "Items", value: "1, 2, 3" },
      { kind: "choice", label: "Arrange", options: ["Flow", "Grid"], value: "Flow" },
      { kind: "number", label: "Gap", value: "4" },
    ],
  },
  {
    id: "region",
    group: "Layout",
    name: "Region",
    summary: "Absolute placement only. Children keep their own anchor and do not join a flow or a grid.",
    fields: [
      { kind: "anchor", label: "Anchor" },
      { kind: "offset", label: "Offset" },
    ],
  },
  {
    id: "part",
    group: "Layout",
    name: "Part",
    summary: "Resolves a part by path. PartName is the part library. Region.PartName stays in this profile. Profile.Region.PartName reads another profile.",
    fields: [{ kind: "part", label: "partName", hint: "Part, Region.Part, or Profile.Region.Part" }],
  },
  {
    id: "slot",
    group: "Layout",
    name: "Slot",
    summary: "A hole in a part. It renders whatever was placed inside the part from upstream. It takes no props.",
    fields: [],
  },
  {
    id: "number",
    group: "Data",
    name: "Number",
    summary: "A single numeric reading, such as health or a count.",
    fields: [
      { kind: "number", label: "Value", value: "650" },
      { kind: "number", label: "Minimum", value: "0" },
      { kind: "number", label: "Maximum", value: "1000" },
    ],
  },
  {
    id: "text",
    group: "Data",
    name: "Text",
    summary: "A string, such as a unit name or a spell name.",
    fields: [{ kind: "text", label: "Value", value: "Ada" }],
  },
  {
    id: "boolean",
    group: "Data",
    name: "Boolean",
    summary: "A yes or no, such as whether a unit exists.",
    fields: [{ kind: "toggle", label: "Value" }],
  },
  {
    id: "color",
    group: "Data",
    name: "Color",
    summary: "Red, green, blue, and alpha.",
    fields: [{ kind: "color", label: "Value" }],
  },
  {
    id: "list",
    group: "Data",
    name: "List",
    summary: "An ordered series. Each walks it. The members are indexes, tokens, or records.",
    fields: [{ kind: "list", label: "Items", value: "party1, party2" }],
  },
  {
    id: "unit",
    group: "Data",
    name: "Unit",
    summary: "A unit token passed into a native call. The token is an argument, not a record.",
    fields: [{ kind: "unit", label: "Token", value: "player" }],
  },
  {
    id: "bar",
    group: "Visuals",
    name: "Bar",
    summary: "A filled track. Minimum, maximum, and current are numbers.",
    fields: [
      { kind: "size", label: "Width", value: "180" },
      { kind: "size", label: "Height", value: "16" },
      { kind: "number", label: "Current", value: "650" },
      { kind: "color", label: "Color" },
      { kind: "choice", label: "Orientation", options: ["Horizontal", "Vertical"], value: "Horizontal" },
    ],
  },
  {
    id: "label",
    group: "Visuals",
    name: "Label",
    summary: "A line of text.",
    fields: [
      { kind: "text", label: "Text", value: "Health" },
      { kind: "number", label: "Font size", value: "12" },
      { kind: "choice", label: "Align", options: ["Left", "Center", "Right"], value: "Left" },
      { kind: "color", label: "Color" },
    ],
  },
  {
    id: "icon",
    group: "Visuals",
    name: "Icon",
    summary: "A texture in a square.",
    fields: [
      { kind: "texture", label: "Texture" },
      { kind: "size", label: "Size", value: "32" },
      { kind: "color", label: "Tint" },
    ],
  },
  {
    id: "portrait",
    group: "Visuals",
    name: "Portrait",
    summary: "The portrait of one unit token.",
    fields: [
      { kind: "unit", label: "Unit", value: "player" },
      { kind: "size", label: "Size", value: "40" },
    ],
  },
  {
    id: "button",
    group: "Visuals",
    name: "Button",
    summary: "A secure button. The action and the unit token are fixed when it is mounted.",
    fields: [
      { kind: "unit", label: "Unit", value: "target" },
      { kind: "choice", label: "Mouse button", options: ["Left", "Right", "Middle"], value: "Left" },
      { kind: "keybind", label: "Binding", value: "1" },
      { kind: "toggle", label: "Show hotkey" },
    ],
  },
  {
    id: "hide-frames",
    group: "Effects",
    name: "Hide frames",
    summary: "An effect with no hierarchy. It hides a native unit frame while it is on.",
    fields: [{ kind: "unit", label: "Unit", value: "player" }],
  },
  {
    id: "nameplate",
    group: "Effects",
    name: "Nameplate",
    summary: "Attaches to a Blizzard nameplate. It can restyle the native plate or replace its contents.",
    fields: [
      { kind: "toggle", label: "Replace contents" },
      { kind: "choice", label: "Filter", options: ["Friendly", "Enemy", "All"], value: "Enemy" },
    ],
  },
];

export const inputSpecimens: PrimitiveField[] = [
  { kind: "text", label: "Text", value: "Holy Light" },
  { kind: "number", label: "Number", value: "12" },
  { kind: "size", label: "Size", value: "140" },
  { kind: "toggle", label: "Toggle" },
  { kind: "choice", label: "Choice", options: ["Start", "Center", "End"], value: "Center" },
  { kind: "color", label: "Color" },
  { kind: "anchor", label: "Anchor" },
  { kind: "offset", label: "Offset" },
  { kind: "spacing", label: "Spacing" },
  { kind: "texture", label: "Texture" },
  { kind: "search", label: "Search", hint: "Spell or icon" },
  { kind: "unit", label: "Unit", value: "player" },
  { kind: "list", label: "List", value: "1, 2, 3" },
  { kind: "keybind", label: "Key binding", value: "SHIFT-2" },
  { kind: "part", label: "Part", hint: "Part name" },
];

export function findPrimitive(id: string): PrimitiveSpec | undefined {
  return primitives.find(item => item.id === id);
}

export function primitivesIn(group: PrimitiveGroup): PrimitiveSpec[] {
  return primitives.filter(item => item.group === group);
}
