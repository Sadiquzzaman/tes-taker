export type GeometryToolId =
  | "select"
  | "point"
  | "segment"
  | "line"
  | "ray"
  | "circle"
  | "arc"
  | "triangle"
  | "rectangle"
  | "square"
  | "polygon"
  | "parallel"
  | "perpendicular"
  | "midpoint"
  | "angleBisector"
  | "intersection"
  | "angle"
  | "rightAngle"
  | "text"
  | "length"
  | "angleMeasure";

export type GeometryCategoryId = "basic" | "shapes" | "build" | "labels";

export type GeometryToolDef = {
  id: GeometryToolId;
  label: string;
  title: string;
  hint: string;
  tapsNeeded?: number | "open";
};

export type GeometryCategory = {
  id: GeometryCategoryId;
  label: string;
  tools: GeometryToolDef[];
};

export const GEOMETRY_CATEGORIES: GeometryCategory[] = [
  {
    id: "basic",
    label: "Basic",
    tools: [
      { id: "select", label: "Select", title: "Move and select objects", hint: "Drag points or shapes to move them." },
      { id: "point", label: "Point", title: "Add a labeled point", hint: "Tap the board to place a point (A, B, C…)." },
      {
        id: "segment",
        label: "Segment",
        title: "Line segment",
        hint: "Tap 2 points to draw a line segment.",
        tapsNeeded: 2,
      },
      { id: "line", label: "Line", title: "Infinite line", hint: "Tap 2 points to draw a straight line.", tapsNeeded: 2 },
      { id: "ray", label: "Ray", title: "Ray", hint: "Tap start point, then a second point for the direction.", tapsNeeded: 2 },
      {
        id: "circle",
        label: "Circle",
        title: "Circle",
        hint: "Tap the center, then a point on the rim.",
        tapsNeeded: 2,
      },
      {
        id: "arc",
        label: "Arc",
        title: "Arc",
        hint: "Tap center, then start of arc, then end of arc.",
        tapsNeeded: 3,
      },
    ],
  },
  {
    id: "shapes",
    label: "Shapes",
    tools: [
      {
        id: "triangle",
        label: "Triangle",
        title: "Triangle",
        hint: "Tap 3 corners. The triangle is drawn automatically.",
        tapsNeeded: 3,
      },
      {
        id: "rectangle",
        label: "Rectangle",
        title: "Axis-aligned rectangle",
        hint: "Tap two opposite corners.",
        tapsNeeded: 2,
      },
      {
        id: "square",
        label: "Square",
        title: "Axis-aligned square",
        hint: "Tap one corner, then the opposite corner direction.",
        tapsNeeded: 2,
      },
      {
        id: "polygon",
        label: "Polygon",
        title: "Custom polygon",
        hint: "Tap corners. Press Done polygon when finished (3+ points).",
        tapsNeeded: "open",
      },
    ],
  },
  {
    id: "build",
    label: "Build",
    tools: [
      {
        id: "parallel",
        label: "Parallel",
        title: "Parallel line",
        hint: "Tap 2 points for a guide line, then a point the parallel should pass through.",
        tapsNeeded: 3,
      },
      {
        id: "perpendicular",
        label: "Perp",
        title: "Perpendicular line",
        hint: "Tap 2 points for a guide line, then a point the perpendicular should pass through.",
        tapsNeeded: 3,
      },
      {
        id: "midpoint",
        label: "Midpoint",
        title: "Midpoint",
        hint: "Tap the 2 ends of a segment.",
        tapsNeeded: 2,
      },
      {
        id: "angleBisector",
        label: "Bisector",
        title: "Angle bisector",
        hint: "Tap point on one ray, the vertex, then a point on the other ray.",
        tapsNeeded: 3,
      },
      {
        id: "intersection",
        label: "Cross",
        title: "Intersection of two lines",
        hint: "Tap 2 points for the first line, then 2 points for the second line.",
        tapsNeeded: 4,
      },
      {
        id: "angle",
        label: "Angle",
        title: "Angle mark",
        hint: "Tap point, vertex, then point (like A–B–C).",
        tapsNeeded: 3,
      },
      {
        id: "rightAngle",
        label: "Right ∠",
        title: "Right-angle mark",
        hint: "Tap point, vertex, then point for a right-angle square mark.",
        tapsNeeded: 3,
      },
    ],
  },
  {
    id: "labels",
    label: "Labels",
    tools: [
      { id: "text", label: "Text", title: "Add text", hint: "Tap where the text should go, then type it below." },
      {
        id: "length",
        label: "Length",
        title: "Length label",
        hint: "Tap 2 points of a side, then type the length (e.g. 5 cm).",
        tapsNeeded: 2,
      },
      {
        id: "angleMeasure",
        label: "° Label",
        title: "Angle value",
        hint: "Tap point, vertex, point, then type the angle (e.g. 60°).",
        tapsNeeded: 3,
      },
    ],
  },
];

export const findTool = (id: GeometryToolId): GeometryToolDef => {
  for (const category of GEOMETRY_CATEGORIES) {
    const tool = category.tools.find((item) => item.id === id);
    if (tool) {
      return tool;
    }
  }
  return GEOMETRY_CATEGORIES[0].tools[0];
};

export const nextPointName = (used: Set<string>): string => {
  for (let i = 0; i < 26; i += 1) {
    const name = String.fromCharCode(65 + i);
    if (!used.has(name)) {
      return name;
    }
  }
  let n = 1;
  while (used.has(`P${n}`)) {
    n += 1;
  }
  return `P${n}`;
};
