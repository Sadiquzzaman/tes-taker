export type JxgPoint = {
  elType?: string;
  name?: string;
  id?: string;
  X?: () => number;
  Y?: () => number;
  setAttribute?: (attrs: Record<string, unknown>) => void;
  setName?: (name: string) => void;
};

export type JxgText = {
  elType?: string;
  plaintext?: string;
  setText?: (t: string) => void;
  setAttribute?: (attrs: Record<string, unknown>) => void;
  X?: () => number;
  Y?: () => number;
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

export const isPoint = (el: unknown): el is JxgPoint => {
  const type = (el as JxgPoint)?.elType;
  return Boolean(type && POINT_TYPES.has(type));
};

export const isText = (el: unknown): el is JxgText => (el as JxgText)?.elType === "text";

export const collectPointNames = (board: BoardLike): Set<string> => {
  const names = new Set<string>();
  (board.objectsList || []).forEach((obj) => {
    if (isPoint(obj) && obj.name && /^[A-Z]$|^P\d+$/.test(obj.name)) {
      names.add(obj.name);
    }
  });
  return names;
};

/** Snap radius in user coordinates (~ board units). */
export const SNAP_RADIUS = 0.55;

export const findNearestPoint = (board: BoardLike, x: number, y: number, radius = SNAP_RADIUS): JxgPoint | null => {
  let best: JxgPoint | null = null;
  let bestDist = radius;
  for (const obj of board.objectsList || []) {
    if (!isPoint(obj) || typeof obj.X !== "function" || typeof obj.Y !== "function") {
      continue;
    }
    const dx = obj.X() - x;
    const dy = obj.Y() - y;
    const dist = Math.hypot(dx, dy);
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

export const createLabeledPoint = (
  board: BoardLike,
  x: number,
  y: number,
  usedNames: Set<string>,
  preferredName?: string,
): JxgPoint => {
  const name =
    preferredName ||
    (() => {
      for (let i = 0; i < 26; i += 1) {
        const candidate = String.fromCharCode(65 + i);
        if (!usedNames.has(candidate)) {
          return candidate;
        }
      }
      let n = 1;
      while (usedNames.has(`P${n}`)) {
        n += 1;
      }
      return `P${n}`;
    })();
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

/** Resolve tap to existing nearby point or create a new labeled point. */
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

/**
 * Axis-aligned rectangle from opposite corners A and C.
 * B and D are dependent so moving A/C keeps a true rectangle.
 */
export const createConstrainedRectangle = (board: BoardLike, a: JxgPoint, c: JxgPoint, style: StrokeStyle) => {
  const b = board.create(
    "point",
    [() => (typeof c.X === "function" ? c.X() : 0), () => (typeof a.Y === "function" ? a.Y() : 0)],
    { name: "", size: 3, fillColor: "#49734f", strokeColor: "#2f4d34", label: { visible: false } },
  );
  const d = board.create(
    "point",
    [() => (typeof a.X === "function" ? a.X() : 0), () => (typeof c.Y === "function" ? c.Y() : 0)],
    { name: "", size: 3, fillColor: "#49734f", strokeColor: "#2f4d34", label: { visible: false } },
  );
  return board.create("polygon", [a, b, c, d], {
    borders: lineStyle(style),
    fillColor: "#49734f",
    fillOpacity: 0.08,
    hasInnerPoints: false,
  });
};

/**
 * Square from adjacent corners A → B (side AB).
 * C and D are constructed by rotating AB 90° so sides stay equal and perpendicular.
 */
export const createConstrainedSquare = (board: BoardLike, a: JxgPoint, b: JxgPoint, style: StrokeStyle) => {
  const c = board.create(
    "point",
    [
      () => {
        const ay = a.Y?.() ?? 0;
        const bx = b.X?.() ?? 0;
        const by = b.Y?.() ?? 0;
        const dy = by - ay;
        return bx - dy;
      },
      () => {
        const ax = a.X?.() ?? 0;
        const bx = b.X?.() ?? 0;
        const by = b.Y?.() ?? 0;
        const dx = bx - ax;
        return by + dx;
      },
    ],
    { name: "", size: 3, fillColor: "#49734f", strokeColor: "#2f4d34", label: { visible: false } },
  );
  const d = board.create(
    "point",
    [
      () => {
        const ax = a.X?.() ?? 0;
        const ay = a.Y?.() ?? 0;
        const by = b.Y?.() ?? 0;
        const dy = by - ay;
        return ax - dy;
      },
      () => {
        const ax = a.X?.() ?? 0;
        const ay = a.Y?.() ?? 0;
        const bx = b.X?.() ?? 0;
        const dx = bx - ax;
        return ay + dx;
      },
    ],
    { name: "", size: 3, fillColor: "#49734f", strokeColor: "#2f4d34", label: { visible: false } },
  );
  return board.create("polygon", [a, b, c, d], {
    borders: lineStyle(style),
    fillColor: "#49734f",
    fillOpacity: 0.08,
  });
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
