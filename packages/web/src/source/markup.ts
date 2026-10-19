import type { ElementSpec } from "@codemirror/lang-xml";
import { partReferencePaths, type SampleNode } from "../library";
import { primitives, type PrimitiveSpec } from "../primitives";

interface AttributeSpec {
  name: string;
  values?: string[];
}

const attributes: Record<string, AttributeSpec[]> = {
  Flow: [
    { name: "orientation", values: ["horizontal", "vertical"] },
    { name: "columnGap" },
    { name: "rowGap" },
    { name: "align", values: ["start", "center", "end"] },
  ],
  Grid: [
    { name: "columns" },
    { name: "cellWidth" },
    { name: "cellHeight" },
    { name: "gap" },
  ],
  Each: [
    { name: "arrange", values: ["flow", "grid"] },
    { name: "gap" },
  ],
  Part: [{ name: "partName" }],
  Bar: [{ name: "orientation", values: ["horizontal", "vertical"] }],
  Label: [
    { name: "text" },
    { name: "align", values: ["left", "center", "right"] },
  ],
  Button: [{ name: "unit", values: ["player", "target", "pet", "party1"] }],
  Portrait: [{ name: "unit", values: ["player", "target", "pet", "party1"] }],
  Cell: [
    { name: "name" },
    { name: "width" },
    { name: "height" },
    { name: "anchor", values: ["TL", "T", "TR", "L", "C", "R", "BL", "B", "BR"] },
    { name: "offsetX" },
    { name: "offsetY" },
  ],
};

export function xmlTag(kind: string): string {
  const spec = primitives.find(item => item.name === kind || item.id === kind);
  if (spec === undefined) return kind.replace(/\s+/g, "");
  return tagOf(spec);
}

function tagOf(spec: PrimitiveSpec): string {
  if (/^[A-Za-z_][\w.-]*$/.test(spec.name)) return spec.name;
  return spec.id.split("-").map(part => part.slice(0, 1).toUpperCase() + part.slice(1)).join("");
}

function specForTag(tag: string): PrimitiveSpec | undefined {
  return primitives.find(item => tagOf(item) === tag);
}

const tags = primitives.map(spec => tagOf(spec));

export function markupSchema(): ElementSpec[] {
  const names = partReferencePaths().map(item => item.path);
  return tags.map(name => ({
    name,
    top: true,
    children: name === "Slot" ? [] : tags,
    attributes: (attributes[name] ?? []).map(attr => ({
      name: attr.name,
      values: attr.name === "partName" ? names : attr.values,
    })),
  }));
}

export function serialize(nodes: SampleNode[]): string {
  return writeLevel(nodes.filter(node => node.depth > 0), 1, { i: 0 }, 0);
}

function writeLevel(nodes: SampleNode[], depth: number, cursor: { i: number }, indent: number): string {
  const lines: string[] = [];
  const pad = "  ".repeat(indent);
  while (cursor.i < nodes.length && nodes[cursor.i].depth === depth) {
    const node = nodes[cursor.i];
    cursor.i += 1;
    const tag = xmlTag(node.kind);
    const attrs = { ...node.attrs };
    if (node.kind === "Part" && attrs.partName === undefined && node.name !== "Part") attrs.partName = node.name;
    const attrText = Object.entries(attrs).map(([name, value]) => ` ${name}="${escapeAttr(value)}"`).join("");
    const children = writeLevel(nodes, depth + 1, cursor, indent + 1);
    lines.push(children.length === 0 ? `${pad}<${tag}${attrText} />` : `${pad}<${tag}${attrText}>\n${children}\n${pad}</${tag}>`);
  }
  return lines.join("\n");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function readMarkup(source: string): { nodes: SampleNode[] } | { error: string } {
  const doc = new DOMParser().parseFromString(`<lumaui>${source}</lumaui>`, "application/xml");
  if (doc.querySelector("parsererror") !== null) return { error: "This markup is not valid yet." };
  return { nodes: walk(Array.from(doc.documentElement.children), 1, "") };
}

function walk(elements: Element[], depth: number, path: string): SampleNode[] {
  const nodes: SampleNode[] = [];
  elements.forEach((element, index) => {
    const tag = element.tagName;
    const spec = specForTag(tag);
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) attrs[attr.name] = attr.value;
    const id = `${path}${index}`;
    nodes.push({
      id,
      name: attrs.partName || spec?.name || tag,
      kind: spec?.name || tag,
      depth,
      attrs,
    });
    nodes.push(...walk(Array.from(element.children), depth + 1, `${id}-`));
  });
  return nodes;
}

