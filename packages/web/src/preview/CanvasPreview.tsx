import { createEffect, onCleanup, onMount } from "solid-js";
import { Element } from "../elements/Element";
import { hasCanvas } from "../elements/primitives";
import { modules, resolvePart, type SampleNode } from "../library";
import { paintBackdrop, paintIcon, paintOutlinedText, paintPortrait, paintStatusBar } from "./gameFrame";

interface Branch {
  node: SampleNode;
  children: Branch[];
  hitId: string;
  tint: string;
}

interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  node: SampleNode;
  tint: string;
  children: Box[];
}

const gap = 4;

export function CanvasPreview(props: { root: Element; revision: number; selected?: string; hint?: string; profileId?: string; onSelect: (id: string) => void }) {
  let host: HTMLDivElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let hits: Box[] = [];

  function paint() {
    if (host === undefined || canvas === undefined) return;
    const ratio = window.devicePixelRatio || 1;
    const width = host.clientWidth;
    const height = host.clientHeight;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgb(9, 11, 17)";
    ctx.fillRect(0, 0, width, height);
    const nodes = snapshot(props.root);
    const forest = forestOf(nodes, props.profileId);
    if (forest.length === 0) {
      ctx.fillStyle = "rgb(137, 152, 173)";
      ctx.font = "13px Segoe UI, sans-serif";
      ctx.fillText(props.hint ?? "Right-click the hierarchy to add something here.", 24, 36);
      hits = [];
      return;
    }
    if (nodes[0]?.kind === "Region") {
      hits = [];
      forest.forEach(branch => {
        const size = measure(branch);
        const origin = anchorOrigin(branch.node.attrs?.anchor ?? "C", width, height, size.width, size.height);
        const box = place(branch, origin.x, origin.y);
        hits.push(box);
        draw(ctx, box, props.selected, props.root);
      });
      return;
    }
    const stacked = forest.filter(branch => branch.node.kind !== "Cell");
    const cells = forest.filter(branch => branch.node.kind === "Cell");
    hits = [];
    if (stacked.length > 0) {
      const measured = stacked.map(measure);
      const contentWidth = Math.max(...measured.map(item => item.width));
      const contentHeight = measured.reduce((sum, item) => sum + item.height, 0) + gap * (stacked.length - 1);
      let y = Math.max(24, (height - contentHeight) / 2);
      const x = Math.max(24, (width - contentWidth) / 2);
      stacked.forEach(branch => {
        const box = place(branch, x, y);
        hits.push(box);
        draw(ctx, box, props.selected, props.root);
        y += box.height + gap;
      });
    }
    cells.forEach(branch => {
      const size = measure(branch);
      const origin = anchorOrigin(branch.node.attrs?.anchor ?? "C", width, height, size.width, size.height);
      const box = place(branch, origin.x, origin.y);
      hits.push(box);
      draw(ctx, box, props.selected, props.root);
    });
  }

  onMount(() => {
    const observer = new ResizeObserver(() => paint());
    if (host !== undefined) observer.observe(host);
    paint();
    onCleanup(() => observer.disconnect());
  });

  createEffect(() => {
    props.root;
    props.revision;
    props.selected;
    modules();
    paint();
  });

  function selectAt(event: MouseEvent) {
    if (canvas === undefined) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = flatten(hits).reverse().find(box => x >= box.x && y >= box.y && x <= box.x + box.width && y <= box.y + box.height);
    if (hit !== undefined) props.onSelect(hit.id);
  }

  return (
    <div class="preview-canvas" ref={host}>
      <canvas ref={canvas} aria-label="Preview canvas" onClick={selectAt} />
    </div>
  );
}

function snapshot(root: Element): SampleNode[] {
  const nodes: SampleNode[] = [];
  function walk(element: Element, depth: number) {
    nodes.push({
      id: element.id,
      name: element.label,
      kind: element.tag,
      depth,
      attrs: { ...element.props },
    });
    for (const child of element.children) walk(child, depth + 1);
  }
  walk(root, 0);
  return nodes;
}

function anchorOrigin(anchor: string, canvasWidth: number, canvasHeight: number, boxWidth: number, boxHeight: number): { x: number; y: number } {
  const margin = 16;
  const column = anchor.includes("R") ? 2 : anchor.includes("L") ? 0 : 1;
  const row = anchor.startsWith("B") ? 2 : anchor.startsWith("T") ? 0 : 1;
  const x = column === 0 ? margin : column === 2 ? canvasWidth - boxWidth - margin : (canvasWidth - boxWidth) / 2;
  const y = row === 0 ? margin : row === 2 ? canvasHeight - boxHeight - margin : (canvasHeight - boxHeight) / 2;
  return { x, y };
}

function forestOf(nodes: SampleNode[], profileId?: string): Branch[] {
  const body = nodes.some(node => node.depth === 0) ? nodes.filter(node => node.depth > 0) : nodes;
  const depth = body[0]?.depth ?? 1;
  return branches(body, depth, { i: 0 }, undefined, "rgb(46, 116, 196)", profileId);
}

function branches(nodes: SampleNode[], depth: number, cursor: { i: number }, hitId: string | undefined, tint: string, profileId?: string): Branch[] {
  const list: Branch[] = [];
  while (cursor.i < nodes.length && nodes[cursor.i].depth === depth) {
    const node = nodes[cursor.i];
    cursor.i += 1;
    const nextHit = hitId ?? node.id;
    const nextTint = tintFor(node.name, tint);
    const nested = branches(nodes, depth + 1, cursor, nextHit, nextTint, profileId);
    list.push({
      node,
      hitId: nextHit,
      tint: nextTint,
      children: nested.length > 0 ? nested : savedContents(node, nextHit, nextTint, profileId),
    });
  }
  return list;
}

function savedContents(node: SampleNode, hitId: string, tint: string, profileId?: string): Branch[] {
  const saved = node.kind === "Module" ? moduleContents(node) : node.kind === "Part" ? partContents(node, profileId) : [];
  return branches(saved, saved[0]?.depth ?? 1, { i: 0 }, hitId, tint, profileId);
}

function moduleContents(node: SampleNode): SampleNode[] {
  const id = node.attrs?.moduleId || node.id;
  const item = modules().find(module => module.id === id || module.name === node.name);
  return item?.nodes.filter(child => child.depth > 0) ?? [];
}

function partContents(node: SampleNode, profileId?: string): SampleNode[] {
  const part = resolvePart(node.attrs?.partName || node.name, profileId);
  return part?.nodes.filter(item => item.depth > 0) ?? [];
}

function measure(branch: Branch): { width: number; height: number } {
  const width = numberAttr(branch.node, "width");
  const height = numberAttr(branch.node, "height");
  if (branch.children.length === 0) return intrinsic(branch.node, width, height);
  const pad = branch.node.kind === "Flow" ? 0 : 8;
  const arranged = arrange(branch);
  return {
    width: width ?? arranged.width + pad * 2,
    height: height ?? arranged.height + pad * 2,
  };
}

function intrinsic(node: SampleNode, width?: number, height?: number): { width: number; height: number } {
  if (node.kind === "Cell") return { width: width ?? 140, height: height ?? 40 };
  if (node.kind === "Bar" || node.name === "Fill") return { width: width ?? 180, height: height ?? 14 };
  if (node.kind === "Label") return { width: width ?? Math.max(48, node.name.length * 7), height: height ?? 16 };
  if (node.kind === "Icon") return { width: width ?? 18, height: height ?? 18 };
  if (node.kind === "Slot") return { width: width ?? 120, height: height ?? 22 };
  if (node.kind === "Portrait") return { width: width ?? 40, height: height ?? 40 };
  return { width: width ?? 140, height: height ?? 22 };
}

function arrange(branch: Branch): { width: number; height: number; sizes: { width: number; height: number }[] } {
  const sizes = branch.children.map(measure);
  const spacing = numberAttr(branch.node, "gap") ?? gap;
  if (branch.node.attrs?.orientation === "horizontal") {
    return {
      width: sum(sizes.map(item => item.width)) + spacing * Math.max(sizes.length - 1, 0),
      height: Math.max(...sizes.map(item => item.height), 0),
      sizes,
    };
  }
  return {
    width: Math.max(...sizes.map(item => item.width), 0),
    height: sum(sizes.map(item => item.height)) + spacing * Math.max(sizes.length - 1, 0),
    sizes,
  };
}

function place(branch: Branch, x: number, y: number): Box {
  const size = measure(branch);
  x += numberAttr(branch.node, "offsetX") ?? 0;
  y += numberAttr(branch.node, "offsetY") ?? 0;
  const pad = branch.children.length > 0 && branch.node.kind !== "Flow" ? 8 : 0;
  const spacing = numberAttr(branch.node, "gap") ?? gap;
  const horizontal = branch.node.attrs?.orientation === "horizontal";
  let childX = x + pad;
  let childY = y + pad;
  const children = branch.children.map(child => {
    const box = place(child, childX, childY);
    if (horizontal) childX += box.width + spacing;
    else childY += box.height + spacing;
    return box;
  });
  return { id: branch.hitId, x, y, width: size.width, height: size.height, node: branch.node, tint: branch.tint, children };
}

function draw(ctx: CanvasRenderingContext2D, box: Box, selected: string | undefined, root: Element) {
  const active = box.id === selected;
  ctx.save();
  if (box.node.kind === "Cell") drawCell(ctx, box, root);
  else if (box.node.kind === "Bar" || box.node.name === "Fill") drawBar(ctx, box);
  else if (box.node.kind === "Label") drawLabel(ctx, box);
  else if (box.node.kind === "Icon") drawIcon(ctx, box);
  else if (box.node.kind === "Slot") drawSlot(ctx, box);
  else if (box.node.kind === "Portrait") drawPortrait(ctx, box);
  else drawPlate(ctx, box);
  ctx.restore();
  for (const child of box.children) draw(ctx, child, selected, root);
  if (active) {
    ctx.strokeStyle = "rgb(102, 191, 255)";
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x - 1.5, box.y - 1.5, box.width + 3, box.height + 3);
  }
}

function drawCell(ctx: CanvasRenderingContext2D, box: Box, root: Element) {
  const live = root.find(box.id);
  if (live !== undefined && hasCanvas(live)) {
    live.drawCanvas(ctx, { x: box.x, y: box.y, width: box.width, height: box.height });
    return;
  }
  drawPlate(ctx, box);
}

function drawBar(ctx: CanvasRenderingContext2D, box: Box) {
  paintStatusBar(ctx, box, box.tint, 0.66);
}

function drawLabel(ctx: CanvasRenderingContext2D, box: Box) {
  paintOutlinedText(ctx, box.node.attrs?.text || box.node.name, box);
}

function drawIcon(ctx: CanvasRenderingContext2D, box: Box) {
  paintIcon(ctx, box);
}

function drawSlot(ctx: CanvasRenderingContext2D, box: Box) {
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "rgb(0, 0, 0)";
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.width - 1, box.height - 1);
  ctx.restore();
}

function drawPortrait(ctx: CanvasRenderingContext2D, box: Box) {
  paintPortrait(ctx, box);
}

function drawPlate(ctx: CanvasRenderingContext2D, box: Box) {
  if (box.children.length > 0) return;
  paintBackdrop(ctx, box);
}

function flatten(boxes: Box[]): Box[] {
  return boxes.flatMap(box => [box, ...flatten(box.children)]);
}

function numberAttr(node: SampleNode, name: string): number | undefined {
  const value = Number(node.attrs?.[name]);
  return Number.isFinite(value) && node.attrs?.[name] !== undefined ? value : undefined;
}

function tintFor(name: string, fallback: string): string {
  const text = name.toLowerCase();
  if (text.includes("power")) return "rgb(0, 90, 220)";
  if (text.includes("cast")) return "rgb(230, 180, 30)";
  if (text.includes("health")) return "rgb(0, 200, 0)";
  return fallback;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
