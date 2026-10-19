import type { SampleNode } from "../library";
import { paintBackdrop, paintIcon, paintOutlinedText, paintPortrait, paintStatusBar } from "../preview/gameFrame";
import { Element, type Frame } from "./Element";

type Canvas = CanvasRenderingContext2D;

export class Cell extends Element {
  get tag(): string { return "Cell"; }
  drawCanvas(canvas: Canvas, frame: Frame): void { paintBackdrop(canvas, frame); }
}

export class Flow extends Element {
  get tag(): string { return "Flow"; }
  drawCanvas(_canvas: Canvas, _frame: Frame): void { /* A flow has no pixels of its own. */ }
}

export class Grid extends Element {
  get tag(): string { return "Grid"; }
  drawCanvas(_canvas: Canvas, _frame: Frame): void { /* A grid has no pixels of its own. */ }
}

export class Each extends Element {
  get tag(): string { return "Each"; }
  drawCanvas(_canvas: Canvas, _frame: Frame): void { /* Each has no pixels of its own. */ }
}

export class Region extends Element {
  get tag(): string { return "Region"; }
  drawCanvas(_canvas: Canvas, _frame: Frame): void { /* A region has no pixels of its own. */ }
}

export class Module extends Element {
  get tag(): string { return "Module"; }
  drawCanvas(_canvas: Canvas, _frame: Frame): void { /* A placed module draws the hierarchy it saved. */ }
}

export class Part extends Element {
  get tag(): string { return "Part"; }
  drawCanvas(canvas: Canvas, frame: Frame): void {
    paintStatusBar(canvas, frame, tint(this.props.partName || this.label), 0.66);
  }
}

export class Slot extends Element {
  get tag(): string { return "Slot"; }
  drawCanvas(_canvas: Canvas, _frame: Frame): void { /* A slot shows whatever was placed upstream. */ }
}

export class NumberElement extends Element {
  get tag(): string { return "Number"; }
  drawCanvas(canvas: Canvas, frame: Frame): void { plate(canvas, frame, this.props.value || this.label); }
}

export class TextElement extends Element {
  get tag(): string { return "Text"; }
  drawCanvas(canvas: Canvas, frame: Frame): void { plate(canvas, frame, this.props.value || this.label); }
}

export class BooleanElement extends Element {
  get tag(): string { return "Boolean"; }
  drawCanvas(canvas: Canvas, frame: Frame): void { plate(canvas, frame, this.label); }
}

export class ColorElement extends Element {
  get tag(): string { return "Color"; }
  drawCanvas(canvas: Canvas, frame: Frame): void {
    canvas.fillStyle = "rgb(46, 116, 196)";
    canvas.fillRect(frame.x, frame.y, frame.width, frame.height);
  }
}

export class ListElement extends Element {
  get tag(): string { return "List"; }
  drawCanvas(canvas: Canvas, frame: Frame): void { plate(canvas, frame, this.label); }
}

export class UnitElement extends Element {
  get tag(): string { return "Unit"; }
  drawCanvas(canvas: Canvas, frame: Frame): void { plate(canvas, frame, this.props.token || "unit"); }
}

export class Bar extends Element {
  get tag(): string { return "Bar"; }
  drawCanvas(canvas: Canvas, frame: Frame): void { paintStatusBar(canvas, frame, "rgb(0, 200, 0)", 0.66); }
}

export class Label extends Element {
  get tag(): string { return "Label"; }
  drawCanvas(canvas: Canvas, frame: Frame): void {
    paintOutlinedText(canvas, this.props.text || this.label, frame);
  }
}

export class Icon extends Element {
  get tag(): string { return "Icon"; }
  drawCanvas(canvas: Canvas, frame: Frame): void {
    paintIcon(canvas, frame);
  }
}

export class Portrait extends Element {
  get tag(): string { return "Portrait"; }
  drawCanvas(canvas: Canvas, frame: Frame): void {
    paintPortrait(canvas, frame);
  }
}

export class ButtonElement extends Element {
  get tag(): string { return "Button"; }
  drawCanvas(canvas: Canvas, frame: Frame): void { plate(canvas, frame, this.props.unit || "Button"); }
}

export class HideFrames extends Element {
  get tag(): string { return "HideFrames"; }
  drawCanvas(canvas: Canvas, frame: Frame): void { plate(canvas, frame, "Hide frames"); }
}

export class Nameplate extends Element {
  get tag(): string { return "Nameplate"; }
  drawCanvas(canvas: Canvas, frame: Frame): void { plate(canvas, frame, "Nameplate"); }
}

const constructors: Record<string, new (id: string) => Element> = {
  Cell, Flow, Grid, Each, Region, Module, Part, Slot,
  Number: NumberElement, Text: TextElement, Boolean: BooleanElement, Color: ColorElement, List: ListElement, Unit: UnitElement,
  Bar, Label, Icon, Portrait, Button: ButtonElement, HideFrames, Nameplate,
};

export function createElement(tag: string, id: string): Element {
  const Type = constructors[tag] ?? Element;
  return new Type(id);
}

export function hasCanvas(element: Element): element is Element & { drawCanvas: (canvas: Canvas, frame: Frame) => void } {
  return "drawCanvas" in element;
}

export function adopt(nodes: SampleNode[]): Element[] {
  const rooted = nodes.some(node => node.depth === 0);
  const body = rooted ? nodes.filter(node => node.depth > 0) : nodes;
  return nest(body, body[0]?.depth ?? 1, { i: 0 });
}

export function documentFromSamples(nodes: SampleNode[]): Element {
  const rootNode = nodes.find(node => node.depth === 0);
  const root = rootNode?.kind === "Region" ? createElement("Region", rootNode.id) : new Element(rootNode?.id ?? "document");
  if (rootNode !== undefined) {
    if (rootNode.attrs !== undefined) {
      for (const [key, value] of Object.entries(rootNode.attrs)) root.props[key] = value;
    }
    if (root.props.name === undefined || root.props.name.length === 0) root.props.name = rootNode.name;
  }
  root.children = adopt(nodes);
  return root;
}

function nest(nodes: SampleNode[], depth: number, cursor: { i: number }): Element[] {
  const list: Element[] = [];
  while (cursor.i < nodes.length && nodes[cursor.i].depth === depth) {
    const sample = nodes[cursor.i];
    cursor.i += 1;
    const element = createElement(tagFor(sample.kind), sample.id);
    if (sample.attrs !== undefined) {
      for (const [key, value] of Object.entries(sample.attrs)) element.props[key] = value;
    }
    if (element.tag === "Part") {
      if (element.props.partName === undefined || element.props.partName.length === 0) element.props.partName = sample.name;
    } else if (element.props.name === undefined || element.props.name.length === 0) {
      element.props.name = sample.name;
    }
    element.children = nest(nodes, depth + 1, cursor);
    list.push(element);
  }
  return list;
}

function tagFor(kind: string): string {
  if (kind === "Hide frames") return "HideFrames";
  return kind;
}

function plate(canvas: Canvas, frame: Frame, text: string) {
  paintBackdrop(canvas, frame);
  paintOutlinedText(canvas, text, frame);
}

function tint(name: string): string {
  const text = name.toLowerCase();
  if (text.includes("power")) return "rgb(0, 90, 220)";
  if (text.includes("cast")) return "rgb(230, 180, 30)";
  if (text.includes("health")) return "rgb(0, 200, 0)";
  return "rgb(0, 200, 0)";
}
