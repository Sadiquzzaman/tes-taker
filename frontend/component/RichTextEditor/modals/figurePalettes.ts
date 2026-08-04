import type { Editor, IndexKey, TLGeoShapeGeoStyle } from "tldraw";
import { createShapeId, GeoShapeGeoStyle, toRichText } from "tldraw";

export type FigurePaletteItem = {
  id: string;
  label: string;
  title: string;
  run: (editor: Editor) => void;
};

const placeAtViewportCenter = (editor: Editor, width: number, height: number) => {
  const bounds = editor.getViewportPageBounds();
  return {
    x: bounds.midX - width / 2,
    y: bounds.midY - height / 2,
  };
};

const setGeoTool = (editor: Editor, geo: TLGeoShapeGeoStyle) => {
  editor.setStyleForNextShapes(GeoShapeGeoStyle, geo);
  editor.setCurrentTool("geo");
};

const insertTextStamp = (editor: Editor, text: string) => {
  const { x, y } = placeAtViewportCenter(editor, 80, 32);
  editor.createShape({
    id: createShapeId(),
    type: "text",
    x,
    y,
    props: {
      richText: toRichText(text),
      size: "m",
      color: "black",
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

const insertArrowStamp = (editor: Editor, length = 140) => {
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
      arrowheadStart: "none",
      arrowheadEnd: "arrow",
    },
  });
};

const insertLineStamp = (editor: Editor, length = 140) => {
  const { x, y } = placeAtViewportCenter(editor, length, 8);
  editor.createShape({
    id: createShapeId(),
    type: "line",
    x,
    y,
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

export const GEOMETRY_PALETTE: FigurePaletteItem[] = [
  {
    id: "select",
    label: "Select",
    title: "Select and move",
    run: (editor) => editor.setCurrentTool("select"),
  },
  {
    id: "line",
    label: "Line",
    title: "Draw a straight line",
    run: (editor) => editor.setCurrentTool("line"),
  },
  {
    id: "rect",
    label: "Rect",
    title: "Draw a rectangle",
    run: (editor) => setGeoTool(editor, "rectangle"),
  },
  {
    id: "circle",
    label: "Circle",
    title: "Draw a circle / ellipse",
    run: (editor) => setGeoTool(editor, "ellipse"),
  },
  {
    id: "triangle",
    label: "△",
    title: "Insert equilateral-style triangle",
    run: (editor) => insertGeoStamp(editor, "triangle", 140, 120),
  },
  {
    id: "right-triangle",
    label: "∟△",
    title: "Insert right triangle mark + 90°",
    run: (editor) => {
      insertGeoStamp(editor, "triangle", 150, 110);
      insertTextStamp(editor, "90°");
    },
  },
  {
    id: "angle",
    label: "∠",
    title: "Insert angle label",
    run: (editor) => insertTextStamp(editor, "∠ ABC"),
  },
  {
    id: "parallel",
    label: "∥",
    title: "Insert parallel mark",
    run: (editor) => insertTextStamp(editor, "∥"),
  },
  {
    id: "dim-5cm",
    label: "5 cm",
    title: "Insert length label 5 cm",
    run: (editor) => insertTextStamp(editor, "5 cm"),
  },
  {
    id: "dim-90",
    label: "90°",
    title: "Insert 90° label",
    run: (editor) => insertTextStamp(editor, "90°"),
  },
  {
    id: "text",
    label: "Text",
    title: "Add text",
    run: (editor) => editor.setCurrentTool("text"),
  },
];

export const CHEMISTRY_PALETTE: FigurePaletteItem[] = [
  {
    id: "draw",
    label: "Pen",
    title: "Freehand draw",
    run: (editor) => editor.setCurrentTool("draw"),
  },
  {
    id: "arrow",
    label: "→",
    title: "Reaction arrow",
    run: (editor) => insertArrowStamp(editor),
  },
  {
    id: "eq",
    label: "⇌",
    title: "Equilibrium arrow",
    run: (editor) => insertTextStamp(editor, "⇌"),
  },
  {
    id: "darrow",
    label: "↔",
    title: "Resonance / reversible arrow",
    run: (editor) => insertTextStamp(editor, "↔"),
  },
  {
    id: "plus",
    label: "+",
    title: "Plus sign",
    run: (editor) => insertTextStamp(editor, "+"),
  },
  {
    id: "minus",
    label: "−",
    title: "Minus sign",
    run: (editor) => insertTextStamp(editor, "−"),
  },
  {
    id: "delta",
    label: "Δ",
    title: "Heat / change symbol",
    run: (editor) => insertTextStamp(editor, "Δ"),
  },
  {
    id: "catalyst",
    label: "cat.",
    title: "Catalyst label",
    run: (editor) => insertTextStamp(editor, "cat."),
  },
  {
    id: "ring",
    label: "⬡",
    title: "Benzene / hexagon ring",
    run: (editor) => insertGeoStamp(editor, "hexagon", 120, 120),
  },
  {
    id: "bond",
    label: "—",
    title: "Bond line",
    run: (editor) => insertLineStamp(editor, 100),
  },
  {
    id: "h2o",
    label: "H₂O",
    title: "Insert H₂O",
    run: (editor) => insertTextStamp(editor, "H₂O"),
  },
  {
    id: "hplus",
    label: "H⁺",
    title: "Insert H⁺",
    run: (editor) => insertTextStamp(editor, "H⁺"),
  },
  {
    id: "e",
    label: "e⁻",
    title: "Insert electron",
    run: (editor) => insertTextStamp(editor, "e⁻"),
  },
  {
    id: "dh",
    label: "ΔH",
    title: "Insert ΔH",
    run: (editor) => insertTextStamp(editor, "ΔH"),
  },
  {
    id: "text",
    label: "Text",
    title: "Add formula text",
    run: (editor) => editor.setCurrentTool("text"),
  },
];
