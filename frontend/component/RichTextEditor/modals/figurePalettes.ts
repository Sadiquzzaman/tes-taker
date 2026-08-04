import type { Editor, IndexKey, TLGeoShapeGeoStyle } from "tldraw";
import { createShapeId, GeoShapeGeoStyle, toRichText } from "tldraw";

export type FigurePaletteItem = {
  id: string;
  label: string;
  title: string;
  run: (editor: Editor) => void;
};

export type FigurePaletteGroup = {
  id: string;
  label: string;
  items: FigurePaletteItem[];
};

const placeAtViewportCenter = (editor: Editor, width: number, height: number, jitter = true) => {
  const bounds = editor.getViewportPageBounds();
  const offset = jitter ? ((Math.random() * 56) | 0) - 12 : 0;
  return {
    x: bounds.midX - width / 2 + offset,
    y: bounds.midY - height / 2 + offset,
  };
};

const setGeoTool = (editor: Editor, geo: TLGeoShapeGeoStyle) => {
  editor.setStyleForNextShapes(GeoShapeGeoStyle, geo);
  editor.setCurrentTool("geo");
};

export const insertTextStamp = (editor: Editor, text: string, size: "s" | "m" | "l" = "m") => {
  const { x, y } = placeAtViewportCenter(editor, Math.max(48, text.length * 10), 28);
  editor.createShape({
    id: createShapeId(),
    type: "text",
    x,
    y,
    props: {
      richText: toRichText(text),
      size,
      color: "black",
      font: "sans",
    },
  });
};

const insertGeoStamp = (editor: Editor, geo: TLGeoShapeGeoStyle, width: number, height: number) => {
  const { x, y } = placeAtViewportCenter(editor, width, height);
  editor.createShape({
    id: createShapeId(),
    type: "geo",
    x,
    y,
    props: {
      geo,
      w: width,
      h: height,
      color: "black",
      fill: "none",
      size: "m",
    },
  });
};

const insertArrowStamp = (
  editor: Editor,
  length = 140,
  options?: { arrowheadStart?: "none" | "arrow"; arrowheadEnd?: "none" | "arrow" },
) => {
  const { x, y } = placeAtViewportCenter(editor, length, 20);
  editor.createShape({
    id: createShapeId(),
    type: "arrow",
    x,
    y,
    props: {
      start: { x: 0, y: 0 },
      end: { x: length, y: 0 },
      color: "black",
      size: "m",
      arrowheadStart: options?.arrowheadStart ?? "none",
      arrowheadEnd: options?.arrowheadEnd ?? "arrow",
    },
  });
};

const insertLineStamp = (editor: Editor, length = 140, rotation = 0) => {
  const { x, y } = placeAtViewportCenter(editor, length, 8);
  editor.createShape({
    id: createShapeId(),
    type: "line",
    x,
    y,
    rotation,
    props: {
      points: {
        a1: { id: "a1", index: "a1" as IndexKey, x: 0, y: 0 },
        a2: { id: "a2", index: "a2" as IndexKey, x: length, y: 0 },
      },
      color: "black",
      size: "m",
      spline: "line",
    },
  });
};

/** Right triangle from three line segments + separate 90° label (no overlap). */
const insertRightTriangleFigure = (editor: Editor) => {
  const w = 150;
  const h = 110;
  const { x, y } = placeAtViewportCenter(editor, w + 40, h, false);

  editor.createShape({
    id: createShapeId(),
    type: "line",
    x,
    y: y + h,
    props: {
      points: {
        a1: { id: "a1", index: "a1" as IndexKey, x: 0, y: 0 },
        a2: { id: "a2", index: "a2" as IndexKey, x: w, y: 0 },
      },
      color: "black",
      size: "m",
      spline: "line",
    },
  });
  editor.createShape({
    id: createShapeId(),
    type: "line",
    x,
    y,
    props: {
      points: {
        a1: { id: "a1", index: "a1" as IndexKey, x: 0, y: 0 },
        a2: { id: "a2", index: "a2" as IndexKey, x: 0, y: h },
      },
      color: "black",
      size: "m",
      spline: "line",
    },
  });
  editor.createShape({
    id: createShapeId(),
    type: "line",
    x,
    y,
    props: {
      points: {
        a1: { id: "a1", index: "a1" as IndexKey, x: 0, y: 0 },
        a2: { id: "a2", index: "a2" as IndexKey, x: w, y: h },
      },
      color: "black",
      size: "m",
      spline: "line",
    },
  });
  editor.createShape({
    id: createShapeId(),
    type: "geo",
    x: x + 8,
    y: y + h - 22,
    props: {
      geo: "rectangle",
      w: 16,
      h: 16,
      color: "black",
      fill: "none",
      size: "s",
    },
  });
  editor.createShape({
    id: createShapeId(),
    type: "text",
    x: x + w + 10,
    y: y + h - 28,
    props: {
      richText: toRichText("90°"),
      size: "s",
      color: "black",
    },
  });
};

const insertAxes = (editor: Editor) => {
  const { x, y } = placeAtViewportCenter(editor, 220, 220, false);
  editor.createShape({
    id: createShapeId(),
    type: "arrow",
    x: x,
    y: y + 110,
    props: {
      start: { x: 0, y: 0 },
      end: { x: 220, y: 0 },
      color: "black",
      size: "s",
      arrowheadStart: "none",
      arrowheadEnd: "arrow",
    },
  });
  editor.createShape({
    id: createShapeId(),
    type: "arrow",
    x: x + 110,
    y: y + 220,
    props: {
      start: { x: 0, y: 0 },
      end: { x: 0, y: -220 },
      color: "black",
      size: "s",
      arrowheadStart: "none",
      arrowheadEnd: "arrow",
    },
  });
  editor.createShape({
    id: createShapeId(),
    type: "text",
    x: x + 210,
    y: y + 118,
    props: { richText: toRichText("x"), size: "s", color: "black" },
  });
  editor.createShape({
    id: createShapeId(),
    type: "text",
    x: x + 118,
    y: y - 8,
    props: { richText: toRichText("y"), size: "s", color: "black" },
  });
};

export const promptAndInsertEquation = (editor: Editor, placeholder: string) => {
  const value = window.prompt("Type equation / formula / reaction:", placeholder);
  if (!value?.trim()) {
    return;
  }
  insertTextStamp(editor, value.trim(), "m");
};

export const applyCadLiteDefaults = (editor: Editor) => {
  editor.updateInstanceState({ isGridMode: true });
  editor.user.updateUserPreferences({ isSnapMode: true });
  editor.setCurrentTool("select");
};

export const applyChemistryDefaults = (editor: Editor) => {
  editor.updateInstanceState({ isGridMode: false });
  editor.user.updateUserPreferences({ isSnapMode: true });
  editor.setCurrentTool("draw");
};

export const GEOMETRY_GROUPS: FigurePaletteGroup[] = [
  {
    id: "tools",
    label: "Tools",
    items: [
      { id: "select", label: "Select", title: "Select and move", run: (e) => e.setCurrentTool("select") },
      { id: "line", label: "Line", title: "Straight line", run: (e) => e.setCurrentTool("line") },
      { id: "draw", label: "Pen", title: "Freehand", run: (e) => e.setCurrentTool("draw") },
      { id: "arrow-tool", label: "Arrow", title: "Draw arrow / vector", run: (e) => e.setCurrentTool("arrow") },
      { id: "text", label: "Text", title: "Add text / equation", run: (e) => e.setCurrentTool("text") },
      {
        id: "eq-custom",
        label: "Eq…",
        title: "Type a geometry equation or expression",
        run: (e) => promptAndInsertEquation(e, "a² + b² = c²"),
      },
    ],
  },
  {
    id: "shapes",
    label: "Shapes",
    items: [
      { id: "rect", label: "Rect", title: "Rectangle", run: (e) => setGeoTool(e, "rectangle") },
      { id: "square", label: "Square", title: "Insert square", run: (e) => insertGeoStamp(e, "rectangle", 120, 120) },
      { id: "circle", label: "Circle", title: "Circle / ellipse tool", run: (e) => setGeoTool(e, "ellipse") },
      { id: "oval", label: "Oval", title: "Insert oval", run: (e) => insertGeoStamp(e, "oval", 160, 100) },
      { id: "triangle", label: "△", title: "Triangle tool", run: (e) => setGeoTool(e, "triangle") },
      { id: "triangle-stamp", label: "△+", title: "Insert triangle", run: (e) => insertGeoStamp(e, "triangle", 140, 120) },
      { id: "right-tri", label: "∟△", title: "Right triangle figure", run: insertRightTriangleFigure },
      { id: "diamond", label: "◇", title: "Diamond / rhombus", run: (e) => setGeoTool(e, "diamond") },
      { id: "pentagon", label: "⬠", title: "Pentagon", run: (e) => setGeoTool(e, "pentagon") },
      { id: "hexagon", label: "⬡", title: "Hexagon", run: (e) => setGeoTool(e, "hexagon") },
      { id: "octagon", label: "Oct", title: "Octagon", run: (e) => setGeoTool(e, "octagon") },
      { id: "star", label: "★", title: "Star", run: (e) => setGeoTool(e, "star") },
      { id: "trap", label: "Trap", title: "Trapezoid", run: (e) => setGeoTool(e, "trapezoid") },
      { id: "cloud", label: "Cloud", title: "Cloud shape", run: (e) => setGeoTool(e, "cloud") },
    ],
  },
  {
    id: "construction",
    label: "Construction",
    items: [
      { id: "axes", label: "Axes", title: "Insert x–y axes", run: insertAxes },
      { id: "parallel", label: "∥", title: "Parallel mark", run: (e) => insertTextStamp(e, "∥") },
      { id: "perp", label: "⊥", title: "Perpendicular mark", run: (e) => insertTextStamp(e, "⊥") },
      { id: "cong", label: "≅", title: "Congruent mark", run: (e) => insertTextStamp(e, "≅") },
      { id: "sim", label: "∼", title: "Similar mark", run: (e) => insertTextStamp(e, "∼") },
      { id: "angle", label: "∠", title: "Angle symbol", run: (e) => insertTextStamp(e, "∠") },
      { id: "degree", label: "°", title: "Degree symbol", run: (e) => insertTextStamp(e, "°") },
      { id: "tick", label: "|||", title: "Tick / hash marks", run: (e) => insertTextStamp(e, "|||") },
    ],
  },
  {
    id: "labels",
    label: "Labels & equations",
    items: [
      { id: "dim-3", label: "3 cm", title: "3 cm", run: (e) => insertTextStamp(e, "3 cm") },
      { id: "dim-4", label: "4 cm", title: "4 cm", run: (e) => insertTextStamp(e, "4 cm") },
      { id: "dim-5", label: "5 cm", title: "5 cm", run: (e) => insertTextStamp(e, "5 cm") },
      { id: "dim-6", label: "6 cm", title: "6 cm", run: (e) => insertTextStamp(e, "6 cm") },
      { id: "dim-10", label: "10 cm", title: "10 cm", run: (e) => insertTextStamp(e, "10 cm") },
      { id: "a30", label: "30°", title: "30°", run: (e) => insertTextStamp(e, "30°") },
      { id: "a45", label: "45°", title: "45°", run: (e) => insertTextStamp(e, "45°") },
      { id: "a60", label: "60°", title: "60°", run: (e) => insertTextStamp(e, "60°") },
      { id: "a90", label: "90°", title: "90°", run: (e) => insertTextStamp(e, "90°") },
      { id: "a180", label: "180°", title: "180°", run: (e) => insertTextStamp(e, "180°") },
      { id: "pi", label: "π", title: "Pi", run: (e) => insertTextStamp(e, "π") },
      { id: "sqrt", label: "√", title: "Square root", run: (e) => insertTextStamp(e, "√") },
      { id: "pythag", label: "a²+b²=c²", title: "Pythagoras", run: (e) => insertTextStamp(e, "a² + b² = c²") },
      { id: "area", label: "A=½bh", title: "Triangle area", run: (e) => insertTextStamp(e, "A = ½bh") },
      { id: "circ", label: "C=2πr", title: "Circumference", run: (e) => insertTextStamp(e, "C = 2πr") },
    ],
  },
];

export const CHEMISTRY_GROUPS: FigurePaletteGroup[] = [
  {
    id: "tools",
    label: "Tools",
    items: [
      { id: "draw", label: "Pen", title: "Freehand draw", run: (e) => e.setCurrentTool("draw") },
      { id: "select", label: "Select", title: "Select and move", run: (e) => e.setCurrentTool("select") },
      { id: "line", label: "Line", title: "Bond / line tool", run: (e) => e.setCurrentTool("line") },
      { id: "arrow-tool", label: "Arrow", title: "Draw reaction arrow", run: (e) => e.setCurrentTool("arrow") },
      { id: "text", label: "Text", title: "Add formula text", run: (e) => e.setCurrentTool("text") },
      {
        id: "eq-custom",
        label: "Eq…",
        title: "Type a full chemical equation",
        run: (e) => promptAndInsertEquation(e, "2H₂ + O₂ → 2H₂O"),
      },
    ],
  },
  {
    id: "arrows",
    label: "Reaction arrows",
    items: [
      { id: "arrow", label: "→", title: "Forward reaction", run: (e) => insertArrowStamp(e) },
      { id: "eq", label: "⇌", title: "Equilibrium", run: (e) => insertTextStamp(e, "⇌") },
      { id: "darrow", label: "↔", title: "Resonance", run: (e) => insertTextStamp(e, "↔") },
      {
        id: "rev",
        label: "⇄",
        title: "Reversible",
        run: (e) => insertTextStamp(e, "⇄"),
      },
      { id: "up", label: "↑", title: "Gas evolved", run: (e) => insertTextStamp(e, "↑") },
      { id: "down", label: "↓", title: "Precipitate", run: (e) => insertTextStamp(e, "↓") },
      {
        id: "bi",
        label: "↔→",
        title: "Double-headed arrow shape",
        run: (e) => insertArrowStamp(e, 140, { arrowheadStart: "arrow", arrowheadEnd: "arrow" }),
      },
    ],
  },
  {
    id: "structure",
    label: "Bonds & rings",
    items: [
      { id: "bond", label: "—", title: "Single bond", run: (e) => insertLineStamp(e, 90) },
      { id: "dbond", label: "=", title: "Double bond mark", run: (e) => insertTextStamp(e, "=") },
      { id: "tbond", label: "≡", title: "Triple bond mark", run: (e) => insertTextStamp(e, "≡") },
      { id: "ring", label: "⬡", title: "Hexagon / benzene ring", run: (e) => insertGeoStamp(e, "hexagon", 110, 110) },
      { id: "pent", label: "⬠", title: "Pentagon ring", run: (e) => insertGeoStamp(e, "pentagon", 110, 110) },
      { id: "circ", label: "○", title: "Circle (aromatic)", run: (e) => insertGeoStamp(e, "ellipse", 70, 70) },
      { id: "wedge", label: "▸", title: "Wedge / stereo mark", run: (e) => insertTextStamp(e, "▸") },
      { id: "dash", label: "┄", title: "Dash bond mark", run: (e) => insertTextStamp(e, "┄") },
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    items: [
      { id: "plus", label: "+", title: "Plus", run: (e) => insertTextStamp(e, "+") },
      { id: "minus", label: "−", title: "Minus", run: (e) => insertTextStamp(e, "−") },
      { id: "delta", label: "Δ", title: "Heat", run: (e) => insertTextStamp(e, "Δ") },
      { id: "hv", label: "hν", title: "Light", run: (e) => insertTextStamp(e, "hν") },
      { id: "catalyst", label: "cat.", title: "Catalyst", run: (e) => insertTextStamp(e, "cat.") },
      { id: "e", label: "e⁻", title: "Electron", run: (e) => insertTextStamp(e, "e⁻") },
      { id: "dh", label: "ΔH", title: "Enthalpy", run: (e) => insertTextStamp(e, "ΔH") },
      { id: "dg", label: "ΔG", title: "Gibbs free energy", run: (e) => insertTextStamp(e, "ΔG") },
      { id: "ds", label: "ΔS", title: "Entropy", run: (e) => insertTextStamp(e, "ΔS") },
      { id: "aq", label: "(aq)", title: "Aqueous", run: (e) => insertTextStamp(e, "(aq)") },
      { id: "g", label: "(g)", title: "Gas", run: (e) => insertTextStamp(e, "(g)") },
      { id: "s", label: "(s)", title: "Solid", run: (e) => insertTextStamp(e, "(s)") },
      { id: "l", label: "(l)", title: "Liquid", run: (e) => insertTextStamp(e, "(l)") },
    ],
  },
  {
    id: "formulas",
    label: "Common formulas",
    items: [
      { id: "h2o", label: "H₂O", title: "Water", run: (e) => insertTextStamp(e, "H₂O") },
      { id: "h2", label: "H₂", title: "Hydrogen", run: (e) => insertTextStamp(e, "H₂") },
      { id: "o2", label: "O₂", title: "Oxygen", run: (e) => insertTextStamp(e, "O₂") },
      { id: "n2", label: "N₂", title: "Nitrogen", run: (e) => insertTextStamp(e, "N₂") },
      { id: "co2", label: "CO₂", title: "Carbon dioxide", run: (e) => insertTextStamp(e, "CO₂") },
      { id: "co", label: "CO", title: "Carbon monoxide", run: (e) => insertTextStamp(e, "CO") },
      { id: "nh3", label: "NH₃", title: "Ammonia", run: (e) => insertTextStamp(e, "NH₃") },
      { id: "ch4", label: "CH₄", title: "Methane", run: (e) => insertTextStamp(e, "CH₄") },
      { id: "hcl", label: "HCl", title: "Hydrochloric acid", run: (e) => insertTextStamp(e, "HCl") },
      { id: "h2so4", label: "H₂SO₄", title: "Sulfuric acid", run: (e) => insertTextStamp(e, "H₂SO₄") },
      { id: "naoh", label: "NaOH", title: "Sodium hydroxide", run: (e) => insertTextStamp(e, "NaOH") },
      { id: "nacl", label: "NaCl", title: "Sodium chloride", run: (e) => insertTextStamp(e, "NaCl") },
      { id: "c6h12o6", label: "C₆H₁₂O₆", title: "Glucose", run: (e) => insertTextStamp(e, "C₆H₁₂O₆") },
      { id: "hplus", label: "H⁺", title: "Proton", run: (e) => insertTextStamp(e, "H⁺") },
      { id: "oh", label: "OH⁻", title: "Hydroxide", run: (e) => insertTextStamp(e, "OH⁻") },
      { id: "h3o", label: "H₃O⁺", title: "Hydronium", run: (e) => insertTextStamp(e, "H₃O⁺") },
    ],
  },
  {
    id: "equations",
    label: "Example equations",
    items: [
      {
        id: "eq-water",
        label: "2H₂+O₂→2H₂O",
        title: "Water formation",
        run: (e) => insertTextStamp(e, "2H₂ + O₂ → 2H₂O"),
      },
      {
        id: "eq-comb",
        label: "CH₄+O₂→…",
        title: "Methane combustion",
        run: (e) => insertTextStamp(e, "CH₄ + 2O₂ → CO₂ + 2H₂O"),
      },
      {
        id: "eq-neut",
        label: "Acid+Base",
        title: "Neutralization",
        run: (e) => insertTextStamp(e, "HCl + NaOH → NaCl + H₂O"),
      },
      {
        id: "eq-photo",
        label: "Photosyn.",
        title: "Photosynthesis",
        run: (e) => insertTextStamp(e, "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂"),
      },
      {
        id: "eq-eqm",
        label: "N₂⇌NH₃",
        title: "Haber process",
        run: (e) => insertTextStamp(e, "N₂ + 3H₂ ⇌ 2NH₃"),
      },
    ],
  },
];

/** @deprecated flat lists kept for any leftover imports */
export const GEOMETRY_PALETTE: FigurePaletteItem[] = GEOMETRY_GROUPS.flatMap((g) => g.items);
export const CHEMISTRY_PALETTE: FigurePaletteItem[] = CHEMISTRY_GROUPS.flatMap((g) => g.items);
