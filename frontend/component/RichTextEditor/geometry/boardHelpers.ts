import type { SelectableKind } from "./toolCatalog";
import { nextPointName } from "./toolCatalog";

export type JxgPoint = {
  elType?: string;
  name?: string;
  id?: string;
  X?: () => number;
  Y?: () => number;
  setAttribute?: (attrs: Record<string, unknown>) => void;
  setName?: (name: string) => void;
  moveTo?: (coords: number[], time?: number) => void;
  setPosition?: (method: unknown, coords: number[]) => void;
  isDraggable?: boolean;
  visProp?: { fixed?: boolean };
  parents?: unknown[];
};

export type JxgText = {
  elType?: string;
  plaintext?: string;
  setText?: (t: string) => void;
  setAttribute?: (attrs: Record<string, unknown>) => void;
  X?: () => number;
  Y?: () => number;
};

export type JxgCircle = {
  elType?: string;
  id?: string;
  center?: JxgPoint;
  point2?: JxgPoint;
  Radius?: () => number;
  setAttribute?: (attrs: Record<string, unknown>) => void;
};

export type JxgLine = {
  elType?: string;
  id?: string;
  point1?: JxgPoint;
  point2?: JxgPoint;
  setAttribute?: (attrs: Record<string, unknown>) => void;
};

export type SelectableObject = {
  kind: SelectableKind;
  el: unknown;
  label: string;
};

export type BoardLike = {
  create: (type: string, parents: unknown[], attributes?: Record<string, unknown>) => unknown;
  getBoundingBox: () => [number, number, number, number];
  setBoundingBox: (bb: [number, number, number, number], keepaspectratio?: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  update: () => void;
  jc?: { parse: (code: string) => void };
  containerObj?: HTMLElement;
  objectsList?: unknown[];
  getUsrCoordsOfMouse?: (ev: MouseEvent | TouchEvent | PointerEvent) => number[];
  removeObject?: (obj: unknown) => void;
};

const POINT_TYPES = new Set(["point", "glider", "midpoint", "intersection"]);
const LINE_TYPES = new Set(["line", "segment", "arrow", "axis"]);
const POLY_TYPES = new Set(["polygon"]);

export const isPoint = (el: unknown): el is JxgPoint => {
  const type = (el as JxgPoint)?.elType;
  return Boolean(type && POINT_TYPES.has(type));
};

export const isText = (el: unknown): el is JxgText => (el as JxgText)?.elType === "text";

export const isCircle = (el: unknown): el is JxgCircle => (el as JxgCircle)?.elType === "circle";

export const isSegment = (el: unknown): el is JxgLine => (el as JxgLine)?.elType === "segment";

export const isLineLike = (el: unknown): el is JxgLine => {
  const type = (el as JxgLine)?.elType;
  return Boolean(type && LINE_TYPES.has(type));
};

export const isPolygon = (el: unknown): boolean => {
  const type = (el as { elType?: string })?.elType;
  return Boolean(type && POLY_TYPES.has(type));
};

export const isAngle = (el: unknown): boolean => (el as { elType?: string })?.elType === "angle";

export const collectPointNames = (board: BoardLike): Set<string> => {
  const names = new Set<string>();
  (board.objectsList || []).forEach((obj) => {
    if (isPoint(obj) && obj.name && /^[A-Z]$|^P\d+$|^O$|^M$/.test(obj.name)) {
      names.add(obj.name);
    }
  });
  return names;
};

export const SNAP_RADIUS = 0.55;

export const findNearestPoint = (board: BoardLike, x: number, y: number, radius = SNAP_RADIUS): JxgPoint | null => {
  let best: JxgPoint | null = null;
  let bestDist = radius;
  for (const obj of board.objectsList || []) {
    if (!isPoint(obj) || typeof obj.X !== "function" || typeof obj.Y !== "function") {
      continue;
    }
    const dist = Math.hypot(obj.X() - x, obj.Y() - y);
    if (dist <= bestDist) {
      best = obj;
      bestDist = dist;
    }
  }
  return best;
};

export const findNearestText = (board: BoardLike, x: number, y: number, radius = 0.9): JxgText | null => {
  let best: JxgText | null = null;
  let bestDist = radius;
  for (const obj of board.objectsList || []) {
    if (!isText(obj) || typeof obj.X !== "function" || typeof obj.Y !== "function") {
      continue;
    }
    const dist = Math.hypot(obj.X() - x, obj.Y() - y);
    if (dist <= bestDist) {
      best = obj;
      bestDist = dist;
    }
  }
  return best;
};

const pointToSegmentDist = (px: number, py: number, a: JxgPoint, b: JxgPoint): number => {
  const ax = a.X?.() ?? 0;
  const ay = a.Y?.() ?? 0;
  const bx = b.X?.() ?? 0;
  const by = b.Y?.() ?? 0;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) {
    return Math.hypot(px - ax, py - ay);
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/** Hit-test for teacher selection (points → text → segments → circles → polygons). */
export const findSelectableAt = (board: BoardLike, x: number, y: number): SelectableObject | null => {
  const nearPoint = findNearestPoint(board, x, y, 0.65);
  if (nearPoint) {
    return { kind: "point", el: nearPoint, label: nearPoint.name || "Point" };
  }

  const nearText = findNearestText(board, x, y, 1.0);
  if (nearText) {
    return { kind: "text", el: nearText, label: nearText.plaintext || "Text" };
  }

  let bestSeg: SelectableObject | null = null;
  let bestSegDist = 0.35;
  let bestCircle: SelectableObject | null = null;
  let bestCircleDist = 0.4;
  let bestPoly: SelectableObject | null = null;
  let bestPolyDist = 0.4;
  let bestAngle: SelectableObject | null = null;

  for (const obj of board.objectsList || []) {
    if (isSegment(obj) && obj.point1 && obj.point2) {
      const d = pointToSegmentDist(x, y, obj.point1, obj.point2);
      if (d < bestSegDist) {
        bestSegDist = d;
        const n1 = obj.point1.name || "";
        const n2 = obj.point2.name || "";
        bestSeg = { kind: "segment", el: obj, label: n1 && n2 ? `Segment ${n1}${n2}` : "Segment" };
      }
      continue;
    }
    if (isLineLike(obj) && obj.point1 && obj.point2) {
      const d = pointToSegmentDist(x, y, obj.point1, obj.point2);
      if (d < bestSegDist) {
        bestSegDist = d;
        bestSeg = { kind: "line", el: obj, label: "Line" };
      }
    } else if (isCircle(obj) && obj.center && typeof obj.Radius === "function") {
      const cx = obj.center.X?.() ?? 0;
      const cy = obj.center.Y?.() ?? 0;
      const r = obj.Radius();
      const d = Math.abs(Math.hypot(x - cx, y - cy) - r);
      if (d < bestCircleDist) {
        bestCircleDist = d;
        bestCircle = { kind: "circle", el: obj, label: "Circle" };
      }
    } else if (isPolygon(obj)) {
      const verts = (obj as { vertices?: JxgPoint[] }).vertices || [];
      for (let i = 0; i < verts.length; i += 1) {
        const a = verts[i];
        const b = verts[(i + 1) % verts.length];
        if (!a || !b) {
          continue;
        }
        const d = pointToSegmentDist(x, y, a, b);
        if (d < bestPolyDist) {
          bestPolyDist = d;
          bestPoly = { kind: "polygon", el: obj, label: "Shape" };
        }
      }
    } else if (isAngle(obj)) {
      const center = (obj as { point2?: JxgPoint }).point2;
      if (center && typeof center.X === "function" && typeof center.Y === "function") {
        const d = Math.hypot(center.X() - x, center.Y() - y);
        if (d < 1.2) {
          bestAngle = { kind: "angle", el: obj, label: "Angle" };
        }
      }
    }
  }

  return bestSeg || bestCircle || bestPoly || bestAngle;
};

export const clearSelectionHighlight = (el: unknown) => {
  const obj = el as { setAttribute?: (a: Record<string, unknown>) => void; elType?: string };
  if (!obj?.setAttribute) {
    return;
  }
  if (obj.elType === "point" || obj.elType === "glider" || obj.elType === "midpoint" || obj.elType === "intersection") {
    obj.setAttribute({ strokeColor: "#2f4d34", fillColor: "#49734f", size: 4 });
  } else if (obj.elType === "text") {
    obj.setAttribute({ strokeColor: "#0f1a12", cssStyle: "" });
  } else {
    obj.setAttribute({ strokeColor: "#1f2933", highlight: false });
  }
};

export const applySelectionHighlight = (el: unknown) => {
  const obj = el as { setAttribute?: (a: Record<string, unknown>) => void; elType?: string };
  if (!obj?.setAttribute) {
    return;
  }
  if (obj.elType === "point" || obj.elType === "glider" || obj.elType === "midpoint" || obj.elType === "intersection") {
    obj.setAttribute({ strokeColor: "#c0392b", fillColor: "#e74c3c", size: 5 });
  } else if (obj.elType === "text") {
    obj.setAttribute({ strokeColor: "#c0392b" });
  } else {
    obj.setAttribute({ strokeColor: "#c0392b", strokeWidth: 3 });
  }
};

export const createLabeledPoint = (
  board: BoardLike,
  x: number,
  y: number,
  usedNames: Set<string>,
  preferredName?: string,
): JxgPoint => {
  const name = preferredName || nextPointName(usedNames);
  usedNames.add(name);
  return board.create("point", [x, y], {
    name,
    size: 4,
    face: "o",
    fillColor: "#49734f",
    strokeColor: "#2f4d34",
    fixed: false,
    snapToGrid: false,
    label: { offset: [10, 10], fontSize: 16, strokeColor: "#0f1a12", anchorX: "middle" },
  }) as JxgPoint;
};

export const resolvePointAt = (
  board: BoardLike,
  x: number,
  y: number,
  usedNames: Set<string>,
): { point: JxgPoint; created: boolean } => {
  const existing = findNearestPoint(board, x, y);
  if (existing) {
    return { point: existing, created: false };
  }
  return { point: createLabeledPoint(board, x, y, usedNames), created: true };
};

export type StrokeStyle = {
  strokeColor: string;
  strokeWidth: number;
  dash: number;
};

export const lineStyle = (style: StrokeStyle, dashed = false) => ({
  strokeColor: style.strokeColor,
  strokeWidth: style.strokeWidth,
  dash: dashed ? 2 : style.dash,
});

export const createConstrainedRectangle = (board: BoardLike, a: JxgPoint, c: JxgPoint, style: StrokeStyle) => {
  const b = board.create(
    "point",
    [() => (typeof c.X === "function" ? c.X() : 0), () => (typeof a.Y === "function" ? a.Y() : 0)],
    { name: "", size: 3, fillColor: "#49734f", strokeColor: "#2f4d34", label: { visible: false }, withLabel: false },
  );
  const d = board.create(
    "point",
    [() => (typeof a.X === "function" ? a.X() : 0), () => (typeof c.Y === "function" ? c.Y() : 0)],
    { name: "", size: 3, fillColor: "#49734f", strokeColor: "#2f4d34", label: { visible: false }, withLabel: false },
  );
  return board.create("polygon", [a, b, c, d], {
    borders: lineStyle(style),
    fillColor: "#49734f",
    fillOpacity: 0.08,
    hasInnerPoints: false,
  });
};

/** Circle from center + radius point (true geometric circle). */
export const createCircleCenterRadius = (
  board: BoardLike,
  center: JxgPoint,
  rim: JxgPoint,
  style: StrokeStyle,
) => board.create("circle", [center, rim], lineStyle(style));

/**
 * Circle by diameter AB: center = midpoint, radius = AB/2.
 * Returns { center, circle }.
 */
export const createCircleByDiameter = (
  board: BoardLike,
  a: JxgPoint,
  b: JxgPoint,
  style: StrokeStyle,
  usedNames: Set<string>,
) => {
  const name = nextPointName(usedNames);
  usedNames.add(name);
  const center = board.create("midpoint", [a, b], {
    name,
    size: 4,
    fillColor: "#49734f",
    strokeColor: "#2f4d34",
    label: { offset: [10, 10], fontSize: 16 },
  }) as JxgPoint;
  const circle = board.create("circle", [center, a], lineStyle(style));
  board.create("segment", [a, b], { ...lineStyle(style), dash: 2 });
  return { center, circle };
};

/** Add a radius segment from circle center toward a default direction. */
export const addRadiusToCircle = (
  board: BoardLike,
  circle: JxgCircle,
  style: StrokeStyle,
  usedNames: Set<string>,
) => {
  const center = circle.center;
  if (!center || typeof circle.Radius !== "function") {
    throw new Error("Select a circle first.");
  }
  const r = circle.Radius();
  const cx = center.X?.() ?? 0;
  const cy = center.Y?.() ?? 0;
  const gName = nextPointName(usedNames);
  usedNames.add(gName);
  const glider = board.create("glider", [cx + r, cy, circle], {
    name: gName,
    size: 4,
    fillColor: "#49734f",
    label: { offset: [10, 10], fontSize: 16 },
  }) as JxgPoint;
  return board.create("segment", [center, glider], lineStyle(style));
};

/** Add a diameter through the center in a default orientation. */
export const addDiameterToCircle = (
  board: BoardLike,
  circle: JxgCircle,
  style: StrokeStyle,
  usedNames: Set<string>,
) => {
  const center = circle.center;
  if (!center || typeof circle.Radius !== "function") {
    throw new Error("Select a circle first.");
  }
  const r = circle.Radius();
  const cx = center.X?.() ?? 0;
  const cy = center.Y?.() ?? 0;
  const n1 = nextPointName(usedNames);
  usedNames.add(n1);
  const n2 = nextPointName(usedNames);
  usedNames.add(n2);
  const a = board.create("glider", [cx + r, cy, circle], {
    name: n1,
    size: 4,
    fillColor: "#49734f",
    label: { offset: [10, 10], fontSize: 16 },
  }) as JxgPoint;
  const b = board.create(
    "point",
    [() => 2 * (center.X?.() ?? 0) - (a.X?.() ?? 0), () => 2 * (center.Y?.() ?? 0) - (a.Y?.() ?? 0)],
    {
      name: n2,
      size: 4,
      fillColor: "#49734f",
      label: { offset: [10, 10], fontSize: 16 },
    },
  ) as JxgPoint;
  return board.create("segment", [a, b], lineStyle(style));
};

/** Ensure the circle center is a labeled, visible point. */
export const revealCircleCenter = (board: BoardLike, circle: JxgCircle, usedNames: Set<string>) => {
  const center = circle.center;
  if (!center) {
    throw new Error("Select a circle first.");
  }
  if (!center.name || center.name === "") {
    const name = nextPointName(usedNames);
    usedNames.add(name);
    center.setName?.(name);
    center.setAttribute?.({
      visible: true,
      size: 4,
      fillColor: "#49734f",
      withLabel: true,
      label: { visible: true, offset: [10, 10], fontSize: 16 },
    });
  } else {
    center.setAttribute?.({
      visible: true,
      withLabel: true,
      label: { visible: true, offset: [10, 10], fontSize: 16 },
    });
    if (center.name) {
      usedNames.add(center.name);
    }
  }
  board.update();
  return center;
};

export const exportBoardSvg = (board: BoardLike): string | null => {
  const svg = board.containerObj?.querySelector?.("svg") as SVGSVGElement | null;
  if (!svg) {
    return null;
  }
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  return new XMLSerializer().serializeToString(clone);
};

export const movePointTo = (board: BoardLike, point: JxgPoint, x: number, y: number) => {
  if (typeof point.setPosition === "function") {
    point.setPosition(1, [x, y]);
  } else if (typeof point.moveTo === "function") {
    point.moveTo([x, y], 0);
  }
  board.update();
};

/** Free construction points teachers can drag (not midpoints / dependent corners). */
export const isFreeDragPoint = (p: unknown): p is JxgPoint => {
  if (!isPoint(p) || typeof p.X !== "function" || typeof p.Y !== "function") {
    return false;
  }
  if (p.elType !== "point") {
    return false;
  }
  if (p.visProp?.fixed) {
    return false;
  }
  if (p.isDraggable === false) {
    return false;
  }
  return true;
};

const pushUniquePoint = (list: JxgPoint[], point: JxgPoint | undefined | null) => {
  if (!point || list.includes(point)) {
    return;
  }
  list.push(point);
};

/**
 * Anchor points to translate when the teacher drags a whole shape.
 * Dependent points (rectangle side corners, midpoints) are skipped — they follow free parents.
 */
export const getShapeDragPoints = (sel: SelectableObject): JxgPoint[] => {
  const out: JxgPoint[] = [];

  if (sel.kind === "circle" && isCircle(sel.el)) {
    const center = sel.el.center as JxgPoint | undefined;
    if (center && isFreeDragPoint(center)) {
      pushUniquePoint(out, center);
    } else if (center) {
      const parents = (center as JxgPoint & { parents?: unknown[] }).parents || [];
      parents.forEach((parent) => {
        if (isFreeDragPoint(parent)) {
          pushUniquePoint(out, parent);
        }
      });
    }
    if (sel.el.point2 && isFreeDragPoint(sel.el.point2)) {
      pushUniquePoint(out, sel.el.point2);
    }
    return out;
  }

  if (sel.kind === "segment" || sel.kind === "line") {
    const line = sel.el as JxgLine;
    if (isFreeDragPoint(line.point1)) {
      pushUniquePoint(out, line.point1);
    }
    if (isFreeDragPoint(line.point2)) {
      pushUniquePoint(out, line.point2);
    }
    return out;
  }

  if (sel.kind === "polygon") {
    const verts = (sel.el as { vertices?: JxgPoint[] }).vertices || [];
    verts.forEach((v) => {
      if (isFreeDragPoint(v)) {
        pushUniquePoint(out, v);
      }
    });
    return out;
  }

  if (sel.kind === "point" && isFreeDragPoint(sel.el)) {
    pushUniquePoint(out, sel.el);
  }

  if (sel.kind === "text" && isText(sel.el) && typeof sel.el.X === "function" && typeof sel.el.Y === "function") {
    // Text is moved via setAttribute / setPosition on the text element itself
    return [];
  }

  return out;
};

export const translatePoints = (board: BoardLike, points: JxgPoint[], dx: number, dy: number) => {
  if (!dx && !dy) {
    return;
  }
  points.forEach((point) => {
    if (typeof point.X !== "function" || typeof point.Y !== "function") {
      return;
    }
    movePointTo(board, point, point.X() + dx, point.Y() + dy);
  });
};

export const moveTextTo = (board: BoardLike, text: JxgText, x: number, y: number) => {
  const anyText = text as JxgText & {
    setPosition?: (method: unknown, coords: number[]) => void;
    moveTo?: (coords: number[], time?: number) => void;
  };
  if (typeof anyText.setPosition === "function") {
    anyText.setPosition(1, [x, y]);
  } else if (typeof anyText.moveTo === "function") {
    anyText.moveTo([x, y], 0);
  } else {
    text.setAttribute?.({ anchorX: "middle", anchorY: "middle" });
  }
  board.update();
};

export const userCoordsToBoardPixels = (
  board: BoardLike,
  host: HTMLElement,
  x: number,
  y: number,
): { left: number; top: number } => {
  const bb = board.getBoundingBox();
  const [xMin, yMax, xMax, yMin] = bb;
  const width = host.clientWidth || 1;
  const height = host.clientHeight || 1;
  const left = ((x - xMin) / (xMax - xMin || 1)) * width;
  const top = ((yMax - y) / (yMax - yMin || 1)) * height;
  return { left, top };
};

export type DragShapeTool = "circle" | "rectangle" | "square" | "segment";

export const isDragShapeTool = (tool: string, circleMode?: string): boolean => {
  if (tool === "rectangle" || tool === "square" || tool === "segment" || tool === "constructionLine") {
    return true;
  }
  return tool === "circle" && circleMode === "drag";
};

const HANDLE_ATTRS = {
  name: "",
  size: 3,
  fillColor: "#49734f",
  strokeColor: "#2f4d34",
  label: { visible: false },
  showInfobox: false,
  withLabel: false,
};

/**
 * Drag creation (Word-like):
 * - segment: press–drag a short line (use for radius / diameter / diagonal)
 * - circle (drag mode): press = center, drag = radius
 * - rectangle / square: corner → opposite corner
 */
export const startDragShape = (
  board: BoardLike,
  tool: DragShapeTool | "constructionLine",
  x: number,
  y: number,
  style: StrokeStyle,
  usedNames: Set<string>,
  opts?: { dashed?: boolean; snapStart?: JxgPoint | null },
): { start: JxgPoint; end: JxgPoint; shape: unknown } => {
  if (tool === "segment" || tool === "constructionLine") {
    const start = opts?.snapStart && isPoint(opts.snapStart) ? opts.snapStart : (board.create("point", [x, y], HANDLE_ATTRS) as JxgPoint);
    const sx = typeof start.X === "function" ? start.X() : x;
    const sy = typeof start.Y === "function" ? start.Y() : y;
    const end = board.create("point", [sx + 0.02, sy - 0.02], HANDLE_ATTRS) as JxgPoint;
    const shape = board.create("segment", [start, end], lineStyle(style, Boolean(opts?.dashed)));
    return { start, end, shape };
  }

  if (tool === "circle") {
    const center = createLabeledPoint(board, x, y, usedNames);
    const end = board.create("point", [x + 0.02, y - 0.02], HANDLE_ATTRS) as JxgPoint;
    const shape = board.create("circle", [center, end], lineStyle(style));
    return { start: center, end, shape };
  }

  const start = board.create("point", [x, y], HANDLE_ATTRS) as JxgPoint;
  const end = board.create("point", [x + 0.02, y - 0.02], HANDLE_ATTRS) as JxgPoint;

  if (tool === "rectangle") {
    return { start, end, shape: createConstrainedRectangle(board, start, end, style) };
  }

  const sideEnd = board.create(
    "point",
    [
      () => {
        const ax = start.X?.() ?? 0;
        const ay = start.Y?.() ?? 0;
        const bx = end.X?.() ?? 0;
        const by = end.Y?.() ?? 0;
        const side = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
        return ax + Math.sign(bx - ax || 1) * side;
      },
      () => {
        const ax = start.X?.() ?? 0;
        const ay = start.Y?.() ?? 0;
        const bx = end.X?.() ?? 0;
        const by = end.Y?.() ?? 0;
        const side = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
        return ay + Math.sign(by - ay || 1) * side;
      },
    ],
    { visible: false, name: "", withLabel: false },
  ) as JxgPoint;
  return { start, end, shape: createConstrainedRectangle(board, start, sideEnd, style) };
};
