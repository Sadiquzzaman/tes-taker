export type GeometryToolId =
  | "select"
  | "point"
  | "segment"
  | "line"
  | "ray"
  | "constructionLine"
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
  | "perpBisector"
  | "intersection"
  | "tangent"
  | "chord"
  | "angle"
  | "rightAngle"
  | "text"
  | "length"
  | "angleLabel"
  | "delete";

export type GeometryCategoryId = "basic" | "shapes" | "build" | "measure";

export type ToolStep =
  | "idle"
  | "await_point_1"
  | "await_point_2"
  | "await_point_3"
  | "await_point_4"
  | "await_line"
  | "await_circle"
  | "await_text_place"
  | "await_text_input"
  | "await_polygon_more"
  | "complete";

export type GeometryToolDef = {
  id: GeometryToolId;
  label: string;
  title: string;
  /** After completion: stay on tool or return to select */
  afterComplete: "repeat" | "select";
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
      { id: "select", label: "Select", title: "Select, move, or delete", afterComplete: "select" },
      { id: "point", label: "Point", title: "Place a labeled point", afterComplete: "repeat" },
      { id: "segment", label: "Segment", title: "Line segment between two points", afterComplete: "repeat" },
      { id: "line", label: "Line", title: "Infinite line through two points", afterComplete: "repeat" },
      { id: "ray", label: "Ray", title: "Ray from first point through second", afterComplete: "repeat" },
      { id: "constructionLine", label: "Dashed", title: "Dashed construction line", afterComplete: "repeat" },
      { id: "circle", label: "Circle", title: "Circle from center + radius point", afterComplete: "repeat" },
      { id: "arc", label: "Arc", title: "Arc: center, start, end", afterComplete: "repeat" },
    ],
  },
  {
    id: "shapes",
    label: "Shapes",
    tools: [
      { id: "triangle", label: "Triangle", title: "Triangle from 3 points", afterComplete: "select" },
      { id: "rectangle", label: "Rectangle", title: "True rectangle from opposite corners", afterComplete: "select" },
      { id: "square", label: "Square", title: "True square from one side", afterComplete: "select" },
      { id: "polygon", label: "Polygon", title: "Polygon — tap corners, then Finish", afterComplete: "select" },
    ],
  },
  {
    id: "build",
    label: "Build",
    tools: [
      { id: "parallel", label: "Parallel", title: "Parallel through a point", afterComplete: "select" },
      { id: "perpendicular", label: "Perp", title: "Perpendicular through a point", afterComplete: "select" },
      { id: "midpoint", label: "Midpoint", title: "Midpoint of a segment", afterComplete: "select" },
      { id: "perpBisector", label: "Perp bisector", title: "Perpendicular bisector of a segment", afterComplete: "select" },
      { id: "angleBisector", label: "Bisector", title: "Angle bisector", afterComplete: "select" },
      { id: "intersection", label: "Intersect", title: "Intersection of two lines", afterComplete: "select" },
      { id: "tangent", label: "Tangent", title: "Tangent to circle at a point", afterComplete: "select" },
      { id: "chord", label: "Chord", title: "Chord of a circle", afterComplete: "select" },
    ],
  },
  {
    id: "measure",
    label: "Labels",
    tools: [
      { id: "text", label: "Text", title: "Add or edit text", afterComplete: "select" },
      { id: "length", label: "Length", title: "Length / measurement label", afterComplete: "select" },
      { id: "angle", label: "Angle", title: "Angle mark", afterComplete: "select" },
      { id: "rightAngle", label: "Right ∠", title: "Right-angle square mark", afterComplete: "select" },
      { id: "angleLabel", label: "° Text", title: "Custom angle value label", afterComplete: "select" },
      { id: "delete", label: "Delete", title: "Delete selected object", afterComplete: "select" },
    ],
  },
];

export const findTool = (id: GeometryToolId): GeometryToolDef => {
  for (const cat of GEOMETRY_CATEGORIES) {
    const found = cat.tools.find((t) => t.id === id);
    if (found) {
      return found;
    }
  }
  return GEOMETRY_CATEGORIES[0].tools[0];
};

export const instructionFor = (tool: GeometryToolId, step: ToolStep, polygonCount = 0): string => {
  switch (tool) {
    case "select":
      return "Tap an object to select it. Drag points to move. Use Delete to remove.";
    case "point":
      return "Tap the board to place a point (or tap near an existing point to reuse it).";
    case "segment":
      return step === "await_point_2" ? "Now tap the second point (or an existing point)." : "Tap the first point of the segment.";
    case "line":
      return step === "await_point_2" ? "Now tap the second point." : "Tap the first point of the line.";
    case "ray":
      return step === "await_point_2" ? "Now tap a point the ray should pass through." : "Tap where the ray starts.";
    case "constructionLine":
      return step === "await_point_2" ? "Now tap the second point." : "Tap the first point of the dashed line.";
    case "circle":
      return step === "await_point_2"
        ? "Now tap a point on the circle (this sets the radius)."
        : "Tap the center of the circle.";
    case "arc":
      if (step === "await_point_2") {
        return "Tap where the arc starts.";
      }
      if (step === "await_point_3") {
        return "Tap where the arc ends.";
      }
      return "Tap the center of the arc.";
    case "triangle":
      if (step === "await_point_2") {
        return "Tap the second corner.";
      }
      if (step === "await_point_3") {
        return "Tap the third corner.";
      }
      return "Tap the first corner of the triangle.";
    case "rectangle":
      return step === "await_point_2"
        ? "Now tap the opposite corner. A true rectangle will be created."
        : "Tap the first corner of the rectangle.";
    case "square":
      return step === "await_point_2"
        ? "Now tap the next corner along one side. A true square will be created."
        : "Tap the first corner of the square.";
    case "polygon":
      if (step === "await_polygon_more") {
        return `Corners: ${polygonCount}. Tap another corner, or press Finish polygon.`;
      }
      return "Tap the first corner of the polygon.";
    case "parallel":
      if (step === "await_point_2") {
        return "Tap the second point of the guide line (or use an existing line’s points).";
      }
      if (step === "await_point_3") {
        return "Tap the point the parallel line should pass through.";
      }
      return "Tap the first point of the guide line.";
    case "perpendicular":
      if (step === "await_point_2") {
        return "Tap the second point of the guide line.";
      }
      if (step === "await_point_3") {
        return "Tap the point the perpendicular should pass through.";
      }
      return "Tap the first point of the guide line.";
    case "midpoint":
      return step === "await_point_2" ? "Tap the other end of the segment." : "Tap one end of the segment.";
    case "perpBisector":
      return step === "await_point_2" ? "Tap the other end of the segment." : "Tap one end of the segment.";
    case "angleBisector":
      if (step === "await_point_2") {
        return "Tap the vertex.";
      }
      if (step === "await_point_3") {
        return "Tap a point on the other ray.";
      }
      return "Tap a point on the first ray.";
    case "intersection":
      if (step === "await_point_2") {
        return "Tap the second point of line 1.";
      }
      if (step === "await_point_3") {
        return "Tap the first point of line 2.";
      }
      if (step === "await_point_4") {
        return "Tap the second point of line 2.";
      }
      return "Tap the first point of line 1.";
    case "tangent":
      return step === "await_point_2"
        ? "Tap a point on the circle (tangent at that point)."
        : "Tap the center of the circle (or first place the circle).";
    case "chord":
      return step === "await_point_2" ? "Tap the second point on the circle." : "Tap the first point on the circle.";
    case "angle":
    case "rightAngle":
    case "angleLabel":
      if (step === "await_point_2") {
        return "Tap the vertex.";
      }
      if (step === "await_point_3") {
        return "Tap the third point.";
      }
      return "Tap the first point of the angle.";
    case "text":
      return step === "await_text_input"
        ? "Type your text below, then tap Done."
        : "Tap where the text should appear.";
    case "length":
      return step === "await_point_2"
        ? "Tap the other end, then enter the measurement text."
        : "Tap one end of the side to label.";
    case "delete":
      return "Tap an object to select it, then tap Delete again — or use Select + Delete.";
    default:
      return "Choose a tool to begin.";
  }
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

export const initialStepFor = (tool: GeometryToolId): ToolStep => {
  if (tool === "select" || tool === "delete") {
    return "idle";
  }
  if (tool === "text") {
    return "await_text_place";
  }
  return "await_point_1";
};
