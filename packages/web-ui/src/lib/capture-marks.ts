/**
 * Blacking out and marking what a captured app view shows.
 *
 * The browser finds each place in the live DOM and paints over it before the
 * image leaves the page. An agent never has to estimate pixel positions on a
 * picture, and the unredacted pixels of a blacked-out place never reach it.
 */

export interface CaptureMark {
  text: string;
  label?: string;
}

export interface CapturePlan {
  redact: string[];
  mark: CaptureMark[];
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlannedBoxes {
  redact: Box[][];
  mark: (Box | null)[];
}

const MAX_REDACT = 20;
const MAX_MARKS = 9;
const MIN_TERM = 2;
const MAX_TERM = 200;
const REDACT_PAD = 2;
const MARK_PAD = 4;
const MARK_COLOR = "#e5484d";

function term(value: unknown, what: string): string {
  if (typeof value !== "string") throw new Error(`${what} must be text.`);
  const text = value.trim();
  if (text.length < MIN_TERM || text.length > MAX_TERM)
    throw new Error(`${what} must be ${MIN_TERM}–${MAX_TERM} characters.`);
  return text;
}

/** The tool's arguments, checked: a term too short would black out the page. */
export function readCapturePlan(args: Record<string, unknown>): CapturePlan {
  const redact = args.redact ?? [];
  const mark = args.mark ?? [];
  if (!Array.isArray(redact) || redact.length > MAX_REDACT)
    throw new Error(`redact must be a list of at most ${MAX_REDACT} texts.`);
  if (!Array.isArray(mark) || mark.length > MAX_MARKS)
    throw new Error(`mark must be a list of at most ${MAX_MARKS} places.`);
  return {
    redact: redact.map((value) => term(value, "Each text to black out")),
    mark: mark.map((entry) => {
      if (!entry || typeof entry !== "object") throw new Error("Each mark needs a text.");
      const { text, label } = entry as Record<string, unknown>;
      return {
        text: term(text, "Each mark's text"),
        ...(typeof label === "string" && label.trim() ? { label: label.trim().slice(0, 80) } : {}),
      };
    }),
  };
}

function pattern(text: string): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(escaped, "giu");
}

function onScreen(rect: DOMRect | Box): Box | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.max(0, rect.x);
  const y = Math.max(0, rect.y);
  const right = Math.min(window.innerWidth, rect.x + rect.width);
  const bottom = Math.min(window.innerHeight, rect.y + rect.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

function boxesOf(rects: Iterable<DOMRect>): Box[] {
  const boxes: Box[] = [];
  for (const rect of rects) {
    const box = onScreen(rect);
    if (box) boxes.push(box);
  }
  return boxes;
}

function shown(el: Element, skip: (el: Element) => boolean): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) if (skip(node)) return false;
  return true;
}

/** Every place on screen the text appears: in the page's text, and in what a
 * form control shows (its value, or its placeholder while it is empty). */
export function textBoxes(text: string, skip: (el: Element) => boolean): Box[] {
  const found = pattern(text);
  const boxes: Box[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue ?? "";
    if (!node.parentElement || !shown(node.parentElement, skip)) continue;
    for (const match of value.matchAll(found)) {
      const range = document.createRange();
      range.setStart(node, match.index ?? 0);
      range.setEnd(node, (match.index ?? 0) + match[0].length);
      boxes.push(...boxesOf(range.getClientRects()));
    }
  }
  for (const control of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input, textarea, select",
  )) {
    if (!shown(control, skip)) continue;
    const showsText =
      ("value" in control && control.value) ||
      ("placeholder" in control && control.placeholder) ||
      "";
    found.lastIndex = 0;
    if (found.test(showsText)) boxes.push(...boxesOf([control.getBoundingClientRect()]));
  }
  return boxes;
}

const MARKABLE =
  "button, a, [role='button'], [role='tab'], [role='menuitem'], [role='link'], [role='checkbox'], [role='option'], input, textarea, select, label, h1, h2, h3, h4, h5, h6, [aria-label]";

function nameOf(el: Element): string {
  return (
    el.getAttribute("aria-label") ||
    (el as HTMLInputElement).placeholder ||
    el.textContent ||
    (el as HTMLInputElement).value ||
    ""
  );
}

function union(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

/** The control or heading the text names, the smallest that matches; else
 * the first place the text itself appears. */
export function markBox(text: string, skip: (el: Element) => boolean): Box | null {
  const found = pattern(text);
  let best: Box | null = null;
  for (const el of document.querySelectorAll(MARKABLE)) {
    found.lastIndex = 0;
    if (!found.test(nameOf(el)) || !shown(el, skip)) continue;
    const box = onScreen(el.getBoundingClientRect());
    if (box && (!best || box.width * box.height < best.width * best.height)) best = box;
  }
  return best ?? union(textBoxes(text, skip).slice(0, 1));
}

export function planBoxes(plan: CapturePlan, skip: (el: Element) => boolean): PlannedBoxes {
  return {
    redact: plan.redact.map((text) => textBoxes(text, skip)),
    mark: plan.mark.map((entry) => markBox(entry.text, skip)),
  };
}

/** Marks first, then the black boxes over everything: a mark never uncovers
 * what is blacked out. `ratio` maps viewport pixels to canvas pixels. */
export function paintCapture(
  canvas: HTMLCanvasElement,
  boxes: PlannedBoxes,
  ratio = canvas.width / window.innerWidth,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The app view could not be marked.");
  const line = Math.max(2, 3 * ratio);
  boxes.mark.forEach((box, index) => {
    if (!box) return;
    const x = (box.x - MARK_PAD) * ratio;
    const y = (box.y - MARK_PAD) * ratio;
    ctx.strokeStyle = MARK_COLOR;
    ctx.lineWidth = line;
    ctx.strokeRect(x, y, (box.width + 2 * MARK_PAD) * ratio, (box.height + 2 * MARK_PAD) * ratio);
    const size = 18 * ratio;
    ctx.fillStyle = MARK_COLOR;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(12 * ratio)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1), x, y);
  });
  ctx.fillStyle = "#000000";
  for (const box of boxes.redact.flat())
    ctx.fillRect(
      (box.x - REDACT_PAD) * ratio,
      (box.y - REDACT_PAD) * ratio,
      (box.width + 2 * REDACT_PAD) * ratio,
      (box.height + 2 * REDACT_PAD) * ratio,
    );
}
