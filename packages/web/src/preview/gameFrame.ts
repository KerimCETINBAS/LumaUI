import type { Frame } from "../elements/Element";

/** How the game draws a frame: a flat backdrop and a solid edge of strips. Corners stay square. */
export function paintBackdrop(ctx: CanvasRenderingContext2D, frame: Frame): void {
  ctx.fillStyle = "rgb(0, 0, 0)";
  ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
  paintEdge(ctx, frame, "rgb(0, 0, 0)", 1);
}

/** A status bar. The empty track is black. The fill is a flat texture tinted with the bar color. */
export function paintStatusBar(ctx: CanvasRenderingContext2D, frame: Frame, color: string, fraction: number): void {
  ctx.fillStyle = "rgb(0, 0, 0)";
  ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
  const span = Math.max(0, Math.min(1, fraction)) * frame.width;
  ctx.fillStyle = color;
  ctx.fillRect(frame.x, frame.y, span, frame.height);
  paintEdge(ctx, frame, "rgb(0, 0, 0)", 1);
}

/** FontString with the game's outline flag: white fill, black edge, left and middle. */
export function paintOutlinedText(ctx: CanvasRenderingContext2D, text: string, frame: Frame): void {
  ctx.font = "12px 'Arial Narrow', 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgb(0, 0, 0)";
  ctx.strokeText(text, frame.x + 2, frame.y + frame.height / 2);
  ctx.fillStyle = "rgb(255, 255, 255)";
  ctx.fillText(text, frame.x + 2, frame.y + frame.height / 2);
}

/** An icon texture fills its frame. With no file, the slot is a square. */
export function paintIcon(ctx: CanvasRenderingContext2D, frame: Frame): void {
  ctx.fillStyle = "rgb(24, 24, 24)";
  ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
  paintEdge(ctx, frame, "rgb(0, 0, 0)", 1);
}

/** SetPortraitTexture is drawn square. The circular mask is left off. */
export function paintPortrait(ctx: CanvasRenderingContext2D, frame: Frame): void {
  ctx.fillStyle = "rgb(48, 40, 32)";
  ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
  paintEdge(ctx, frame, "rgb(0, 0, 0)", 1);
}

function paintEdge(ctx: CanvasRenderingContext2D, frame: Frame, color: string, thickness: number): void {
  const t = Math.min(thickness, frame.width / 2, frame.height / 2);
  if (t <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(frame.x, frame.y, frame.width, t);
  ctx.fillRect(frame.x, frame.y + frame.height - t, frame.width, t);
  ctx.fillRect(frame.x, frame.y, t, frame.height);
  ctx.fillRect(frame.x + frame.width - t, frame.y, t, frame.height);
}
