import type { JSX } from "solid-js";

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DropPlace = "before" | "inside" | "after";

export interface HierarchyHost {
  depth: number;
  selected?: string;
  drop?: { id: string; place: DropPlace };
  select: (id: string) => void;
  open: (event: MouseEvent, id: string) => void;
  dragStart: (event: DragEvent, id: string) => void;
  dragOver: (event: DragEvent, id: string) => void;
  dropOn: (event: DragEvent, id: string) => void;
  dragEnd: () => void;
}

/** Holds a hierarchy, props, and its source. An element is not drawn. */
export class Element {
  readonly id: string;
  props: Record<string, string> = {};
  children: Element[] = [];

  constructor(id: string) {
    this.id = id;
  }

  get tag(): string {
    return "Element";
  }

  get label(): string {
    return this.props.partName || this.props.name || this.tag;
  }

  source(indent = 0): string {
    const pad = "  ".repeat(indent);
    const attrs = Object.entries(this.props)
      .filter(([, value]) => value.length > 0)
      .map(([name, value]) => ` ${name}="${escapeAttr(value)}"`)
      .join("");
    if (this.children.length === 0) return `${pad}<${this.tag}${attrs} />`;
    const inner = this.children.map(child => child.source(indent + 1)).join("\n");
    return `${pad}<${this.tag}${attrs}>\n${inner}\n${pad}</${this.tag}>`;
  }

  drawHierarchy(host: HierarchyHost): JSX.Element {
    const place = host.drop?.id === this.id ? host.drop.place : undefined;
    return (
      <>
        <button
          type="button"
          class="tree-item"
          classList={{
            "drop-before": place === "before",
            "drop-inside": place === "inside",
            "drop-after": place === "after",
          }}
          draggable={host.depth > 0}
          aria-selected={host.selected === this.id}
          style={{ "padding-left": `${10 + host.depth * 16}px` }}
          onClick={() => host.select(this.id)}
          onContextMenu={event => host.open(event, this.id)}
          onDragStart={event => host.dragStart(event, this.id)}
          onDragOver={event => host.dragOver(event, this.id)}
          onDrop={event => host.dropOn(event, this.id)}
          onDragEnd={() => host.dragEnd()}
        >
          <span>{this.label}</span>
          <small>{this.tag}</small>
        </button>
        {this.children.map(child => child.drawHierarchy({ ...host, depth: host.depth + 1 }))}
      </>
    );
  }

  find(id: string): Element | undefined {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.find(id);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  parentOf(id: string): Element | undefined {
    for (const child of this.children) {
      if (child.id === id) return this;
      const found = child.parentOf(id);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  contains(id: string): boolean {
    return this.find(id) !== undefined;
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
