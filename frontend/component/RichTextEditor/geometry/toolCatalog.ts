/**
 * Teacher-facing tool catalog for the Geometry Workspace.
 * JSXGraph stays an internal engine — these IDs drive friendly UX only.
 */

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

/** How a circle is created when Circle is active. */
export type CircleCreateMode = "centerRadius" | "diameter" | "drag";

export type ToolStep =
  | "idle"
  | "await_point_1"
  | "await_point_2"
  | "await_point_3"
  | "await_point_4"
  | "await_text_place"
  | "await_text_input"
  | "await_polygon_more"
  | "await_circle_mode";

export type GeometryToolDef = {
  id: GeometryToolId;
  label: string;
  title: string;
  afterComplete: "repeat" | "select";
};

/** Primary “Draw” strip — keep short and obvious. */
export const DRAW_TOOLS: GeometryToolDef[] = [
  { id: "select", label: "Select", title: "Select and edit objects", afterComplete: "select" },
  { id: "point", label: "Point", title: "Place a labeled point", afterComplete: "repeat" },
  { id: "segment", label: "Segment", title: "Short line between two points", afterComplete: "repeat" },
  { id: "line", label: "Line", title: "Infinite line through two points", afterComplete: "repeat" },
  { id: "ray", label: "Ray", title: "Ray from a start point", afterComplete: "repeat" },
  { id: "text", label: "Text", title: "Type a label or measurement on the figure", afterComplete: "select" },
];

/** Shape creation strip. */
export const SHAPE_TOOLS: GeometryToolDef[] = [
  { id: "circle", label: "Circle", title: "Draw a circle", afterComplete: "select" },
  { id: "triangle", label: "Triangle", title: "Triangle from three corners", afterComplete: "select" },
  { id: "rectangle", label: "Rectangle", title: "Drag a true rectangle", afterComplete: "select" },
  { id: "square", label: "Square", title: "Drag a true square", afterComplete: "select" },
  { id: "polygon", label: "Polygon", title: "Tap corners, then Finish", afterComplete: "select" },
  { id: "arc", label: "Arc", title: "Arc from center + two points", afterComplete: "select" },
];

/** Construction tools — secondary strip (not the main default view). */
export const CONSTRUCT_TOOLS: GeometryToolDef[] = [
  { id: "perpendicular", label: "Perp", title: "Perpendicular through a point", afterComplete: "select" },
  { id: "parallel", label: "Parallel", title: "Parallel through a point", afterComplete: "select" },
  { id: "midpoint", label: "Midpoint", title: "Midpoint of a segment", afterComplete: "select" },
  { id: "perpBisector", label: "Perp bisector", title: "Perpendicular bisector", afterComplete: "select" },
  { id: "angleBisector", label: "Bisector", title: "Angle bisector", afterComplete: "select" },
  { id: "intersection", label: "Intersect", title: "Intersection of two lines", afterComplete: "select" },
  { id: "angle", label: "Angle", title: "Mark an angle", afterComplete: "select" },
  { id: "rightAngle", label: "Right ∠", title: "Right-angle mark", afterComplete: "select" },
  { id: "constructionLine", label: "Dashed", title: "Dashed construction segment", afterComplete: "repeat" },
  { id: "tangent", label: "Tangent", title: "Tangent to a circle", afterComplete: "select" },
  { id: "chord", label: "Chord", title: "Chord of a circle", afterComplete: "select" },
];

export type ToolbarTab = "draw" | "shapes" | "construct";

export const TOOLBAR_TABS: { id: ToolbarTab; label: string }[] = [
  { id: "draw", label: "Draw" },
  { id: "shapes", label: "Shapes" },
  { id: "construct", label: "Construct" },
];

export const CIRCLE_MODES: { id: CircleCreateMode; label: string; title: string }[] = [
  { id: "centerRadius", label: "Center + radius", title: "Tap center, then a point on the circle" },
  { id: "diameter", label: "Diameter", title: "Tap two endpoints of the diameter" },
  { id: "drag", label: "Drag", title: "Press the center and drag to set the radius" },
];

export type SelectableKind = "point" | "text" | "circle" | "segment" | "line" | "polygon" | "angle" | "other";

export type ContextualActionId =
  | "radius"
  | "diameter"
  | "center"
  | "chord"
  | "tangent"
  | "label"
  | "length"
  | "midpoint"
  | "perpendicular"
  | "parallel"
  | "perpBisector"
  | "angle"
  | "editText"
  | "delete";

export type ContextualAction = {
  id: ContextualActionId;
  label: string;
  title: string;
};

export const contextualActionsFor = (kind: SelectableKind): ContextualAction[] => {
  switch (kind) {
    case "circle":
      return [
        { id: "radius", label: "Radius", title: "Add a radius from the center" },
        { id: "diameter", label: "Diameter", title: "Add a diameter through the center" },
        { id: "center", label: "Center", title: "Show / label the center" },
        { id: "chord", label: "Chord", title: "Draw a chord (tap two points on the circle)" },
        { id: "tangent", label: "Tangent", title: "Draw a tangent at a point on the circle" },
        { id: "label", label: "Label", title: "Add text near this circle" },
        { id: "delete", label: "Delete", title: "Delete this circle" },
      ];
    case "segment":
      return [
        { id: "length", label: "Length", title: "Add a length label (e.g. 5 cm)" },
        { id: "midpoint", label: "Midpoint", title: "Create the midpoint" },
        { id: "perpendicular", label: "Perp", title: "Perpendicular through a point" },
        { id: "perpBisector", label: "Bisector", title: "Perpendicular bisector" },
        { id: "label", label: "Label", title: "Add text near this segment" },
        { id: "delete", label: "Delete", title: "Delete this segment" },
      ];
    case "line":
      return [
        { id: "perpendicular", label: "Perp", title: "Perpendicular through a point" },
        { id: "parallel", label: "Parallel", title: "Parallel through a point" },
        { id: "label", label: "Label", title: "Add text near this line" },
        { id: "delete", label: "Delete", title: "Delete this line" },
      ];
    case "polygon":
      return [
        { id: "label", label: "Label", title: "Add a label" },
        { id: "angle", label: "Angle", title: "Mark an angle" },
        { id: "delete", label: "Delete", title: "Delete this shape" },
      ];
    case "point":
      return [
        { id: "label", label: "Rename", title: "Change the point label" },
        { id: "delete", label: "Delete", title: "Delete this point" },
      ];
    case "text":
      return [
        { id: "editText", label: "Edit", title: "Edit this text" },
        { id: "delete", label: "Delete", title: "Delete this text" },
      ];
    case "angle":
      return [
        { id: "label", label: "Label", title: "Add a degree / custom label" },
        { id: "delete", label: "Delete", title: "Delete this angle mark" },
      ];
    default:
      return [
        { id: "label", label: "Label", title: "Add text" },
        { id: "delete", label: "Delete", title: "Delete" },
      ];
  }
};

export const findTool = (id: GeometryToolId): GeometryToolDef => {
  const all = [...DRAW_TOOLS, ...SHAPE_TOOLS, ...CONSTRUCT_TOOLS];
  return all.find((t) => t.id === id) ?? DRAW_TOOLS[0];
};

export const toolsForTab = (tab: ToolbarTab): GeometryToolDef[] => {
  if (tab === "shapes") {
    return SHAPE_TOOLS;
  }
  if (tab === "construct") {
    return CONSTRUCT_TOOLS;
  }
  return DRAW_TOOLS;
};

export const instructionFor = (
  tool: GeometryToolId,
  step: ToolStep,
  opts?: { circleMode?: CircleCreateMode; polygonCount?: number; hasSelection?: boolean },
): string => {
  const circleMode = opts?.circleMode ?? "centerRadius";
  const polygonCount = opts?.polygonCount ?? 0;

  if (tool === "select") {
    return opts?.hasSelection
      ? "Use the actions below for the selected object — or tap empty space to deselect."
      : "Tap an object to select it. Drag points to move. Choose a tool above to draw.";
  }

  switch (tool) {
    case "point":
      return "Tap the board to place a point.";
    case "segment":
      return step === "await_point_2" ? "Tap the other end of the segment." : "Tap the first end of the segment.";
    case "line":
      return step === "await_point_2" ? "Tap the second point of the line." : "Tap the first point of the line.";
    case "ray":
      return step === "await_point_2" ? "Tap a point the ray should pass through." : "Tap where the ray starts.";
    case "constructionLine":
      return step === "await_point_2" ? "Tap the second point." : "Tap the first point of the dashed line.";
    case "circle":
      if (circleMode === "diameter") {
        return step === "await_point_2"
          ? "Tap the other end of the diameter."
          : "Tap one end of the diameter.";
      }
      if (circleMode === "drag") {
        return step === "await_point_2"
          ? "Keep dragging to set the radius — release to finish."
          : "Press where the center should be, then drag.";
      }
      return step === "await_point_2"
        ? "Tap a point on the circle to set the radius."
        : "Tap where the center of the circle should be.";
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
        ? "Keep dragging — release to finish the rectangle."
        : "Press and drag from one corner to the opposite corner.";
    case "square":
      return step === "await_point_2"
        ? "Keep dragging — release to finish the square."
        : "Press and drag to draw a square.";
    case "polygon":
      if (step === "await_polygon_more") {
        return `Corners: ${polygonCount}. Tap another corner, or tap Finish.`;
      }
      return "Tap the first corner of the polygon.";
    case "parallel":
      if (step === "await_point_2") {
        return "Tap the second point of the guide line.";
      }
      if (step === "await_point_3") {
        return "Tap the point the parallel should pass through.";
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
    case "perpBisector":
    case "chord":
    case "length":
      return step === "await_point_2" ? "Tap the other end." : "Tap one end of the segment.";
    case "angleBisector":
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
        ? "Tap a point on the circle."
        : "Tap the center of the circle.";
    case "text":
      return step === "await_text_input"
        ? "Type your text, then tap Done."
        : "Tap where the text should appear.";
    case "delete":
      return "Tap an object to delete it.";
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

export const initialStepFor = (tool: GeometryToolId, circleMode?: CircleCreateMode): ToolStep => {
  if (tool === "select" || tool === "delete") {
    return "idle";
  }
  if (tool === "text") {
    return "await_text_place";
  }
  if (tool === "circle" && circleMode === "drag") {
    return "await_point_1";
  }
  return "await_point_1";
};
