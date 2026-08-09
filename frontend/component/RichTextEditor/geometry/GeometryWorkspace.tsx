"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import JXG from "jsxgraph";
import "../styles/jsxgraph.css";
import {
  parseFigureDocument,
  serializeFigureDocument,
  svgToDataUrl,
  type FigureInsertPayload,
  type GeometryDocumentV1,
} from "@/utils/figures/figureTypes";
import {
  findTool,
  GEOMETRY_CATEGORIES,
  nextPointName,
  type GeometryCategoryId,
  type GeometryToolId,
} from "./geometryTools";

type GeometryWorkspaceProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (payload: FigureInsertPayload) => void;
  initialDocumentJson?: string | null;
};

type BoardLike = {
  create: (type: string, parents: unknown[], attributes?: Record<string, unknown>) => unknown;
  getBoundingBox: () => [number, number, number, number];
  setBoundingBox: (bb: [number, number, number, number], keepaspectratio?: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  update: () => void;
  jc?: { parse: (code: string) => void };
  containerObj?: HTMLElement;
  objectsList?: Array<{ elType?: string; name?: string; VisProp?: { visible?: boolean } }>;
  getUsrCoordsOfMouse?: (ev: MouseEvent | TouchEvent) => number[];
};

const DEFAULT_BB: [number, number, number, number] = [-8, 6, 8, -6];
const STROKE_COLORS = ["#1f2933", "#49734f", "#c0392b", "#1a73e8", "#8e44ad"];

type PointLike = {
  elType?: string;
  name?: string;
  X?: () => number;
  Y?: () => number;
  setAttribute?: (a: Record<string, unknown>) => void;
};

const GeometryWorkspace = ({ open, onClose, onInsert, initialDocumentJson }: GeometryWorkspaceProps) => {
  const reactId = useId().replace(/:/g, "");
  const boardId = `geo-board-${reactId}`;
  const boardRef = useRef<BoardLike | null>(null);
  const pendingRef = useRef<PointLike[]>([]);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const usedNamesRef = useRef<Set<string>>(new Set());

  const [category, setCategory] = useState<GeometryCategoryId>("basic");
  const [tool, setTool] = useState<GeometryToolId>("point");
  const [hint, setHint] = useState(findTool("point").hint);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAxis, setShowAxis] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#1f2933");
  const [dashed, setDashed] = useState(false);
  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [stepCount, setStepCount] = useState(0);

  const activeCategory = useMemo(
    () => GEOMETRY_CATEGORIES.find((item) => item.id === category) ?? GEOMETRY_CATEGORIES[0],
    [category],
  );

  const styleAttrs = useCallback(
    () => ({
      strokeColor,
      strokeWidth: 2.5,
      dash: dashed ? 2 : 0,
      fillColor: "none",
      fillOpacity: 0,
    }),
    [dashed, strokeColor],
  );

  const syncHistoryButtons = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current >= 0 && historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const collectUsedNames = useCallback((board: BoardLike) => {
    const names = new Set<string>();
    (board.objectsList || []).forEach((obj) => {
      if (obj?.name && /^[A-Z]$|^P\d+$/.test(obj.name)) {
        names.add(obj.name);
      }
    });
    usedNamesRef.current = names;
  }, []);

  const snapshotBoard = useCallback((): string => {
    const board = boardRef.current;
    if (!board) {
      return "";
    }
    try {
      const jessieCode = typeof JXG.Dump?.toJessie === "function" ? JXG.Dump.toJessie(board as never) : "";
      const doc: GeometryDocumentV1 = {
        version: 1,
        kind: "geometry",
        boundingBox: board.getBoundingBox(),
        axis: showAxis,
        grid: showGrid,
        jessieCode: String(jessieCode || ""),
      };
      return serializeFigureDocument(doc);
    } catch {
      return "";
    }
  }, [showAxis, showGrid]);

  const pushHistory = useCallback(() => {
    const snap = snapshotBoard();
    if (!snap) {
      return;
    }
    const next = historyRef.current.slice(0, historyIndexRef.current + 1);
    next.push(snap);
    if (next.length > 50) {
      next.shift();
    }
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    syncHistoryButtons();
    if (boardRef.current) {
      collectUsedNames(boardRef.current);
    }
  }, [collectUsedNames, snapshotBoard, syncHistoryButtons]);

  const exportSvgMarkup = useCallback((): string | null => {
    const host = boardRef.current?.containerObj;
    const svg = host?.querySelector?.("svg") as SVGSVGElement | null;
    if (!svg) {
      return null;
    }
    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    return new XMLSerializer().serializeToString(clone);
  }, []);

  const createLabeledPoint = useCallback(
    (board: BoardLike, x: number, y: number, preferredName?: string) => {
      const name = preferredName || nextPointName(usedNamesRef.current);
      usedNamesRef.current.add(name);
      return board.create("point", [x, y], {
        name,
        size: 4,
        face: "o",
        fillColor: "#49734f",
        strokeColor: "#2f4d34",
        label: { offset: [8, 8], fontSize: 16, strokeColor: "#0f1a12" },
      }) as PointLike;
    },
    [],
  );

  const rebuildFromDocument = useCallback(
    (doc: GeometryDocumentV1) => {
      const existing = boardRef.current as { id?: string } | null;
      if (existing?.id && typeof JXG.JSXGraph.freeBoard === "function") {
        try {
          JXG.JSXGraph.freeBoard(existing as never);
        } catch {
          // ignore
        }
      }
      boardRef.current = null;
      pendingRef.current = [];
      setStepCount(0);
      setPendingText(null);

      const board = JXG.JSXGraph.initBoard(boardId, {
        boundingbox: doc.boundingBox ?? DEFAULT_BB,
        axis: doc.axis,
        grid: doc.grid,
        showCopyright: false,
        showNavigation: false,
        pan: { enabled: true, needTwoFingers: true },
        zoom: { wheel: true, pinch: true },
        keepaspectratio: true,
        browserPan: false,
      } as never) as unknown as BoardLike;
      boardRef.current = board;

      if (doc.jessieCode?.trim() && board.jc?.parse) {
        try {
          board.jc.parse(doc.jessieCode);
        } catch {
          // keep empty board if dump cannot parse
        }
      }
      collectUsedNames(board);
      board.update();
    },
    [boardId, collectUsedNames],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const initial = parseFigureDocument(initialDocumentJson);
    const doc: GeometryDocumentV1 =
      initial && initial.kind === "geometry"
        ? initial
        : {
            version: 1,
            kind: "geometry",
            boundingBox: DEFAULT_BB,
            axis: false,
            grid: true,
            jessieCode: "",
          };

    setShowAxis(doc.axis);
    setShowGrid(doc.grid);
    setError("");
    setTool("point");
    setCategory("basic");
    setHint(findTool("point").hint);
    setStrokeColor("#1f2933");
    setDashed(false);

    const timer = window.setTimeout(() => {
      rebuildFromDocument(doc);
      historyRef.current = [serializeFigureDocument(doc)];
      historyIndexRef.current = 0;
      syncHistoryButtons();
    }, 40);

    return () => {
      window.clearTimeout(timer);
      const board = boardRef.current as { id?: string } | null;
      if (board?.id && typeof JXG.JSXGraph.freeBoard === "function") {
        try {
          JXG.JSXGraph.freeBoard(board as never);
        } catch {
          // ignore
        }
      }
      boardRef.current = null;
    };
  }, [initialDocumentJson, open, rebuildFromDocument, syncHistoryButtons]);

  const resetPending = useCallback(() => {
    pendingRef.current = [];
    setStepCount(0);
  }, []);

  const selectTool = (next: GeometryToolId) => {
    setTool(next);
    setHint(findTool(next).hint);
    setError("");
    setPendingText(null);
    resetPending();
  };

  const finishConstruction = useCallback(() => {
    resetPending();
    pushHistory();
    setError("");
  }, [pushHistory, resetPending]);

  const handleBoardPointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const board = boardRef.current;
      if (!board || tool === "select" || pendingText) {
        return;
      }
      // Avoid browser scroll while drawing on phones
      event.preventDefault();

      const coords =
        typeof board.getUsrCoordsOfMouse === "function"
          ? board.getUsrCoordsOfMouse(event.nativeEvent)
          : null;
      if (!coords || coords.length < 2) {
        return;
      }
      const [x, y] = coords;

      try {
        if (tool === "text") {
          setPendingText({ x, y });
          setTextDraft("");
          setHint("Type your label below, then tap Add text.");
          return;
        }

        if (tool === "point") {
          createLabeledPoint(board, x, y);
          finishConstruction();
          return;
        }

        const point = createLabeledPoint(board, x, y);
        pendingRef.current.push(point);
        const steps = pendingRef.current.length;
        setStepCount(steps);

        if (tool === "segment" || tool === "line" || tool === "ray" || tool === "circle") {
          if (steps < 2) {
            setHint(tool === "circle" ? "Now tap a point on the circle." : "Now tap the second point.");
            return;
          }
          const [a, b] = pendingRef.current;
          if (tool === "segment") {
            board.create("segment", [a, b], styleAttrs());
          } else if (tool === "line") {
            board.create("line", [a, b], styleAttrs());
          } else if (tool === "ray") {
            board.create("line", [a, b], { ...styleAttrs(), straightFirst: false, straightLast: true });
          } else {
            board.create("circle", [a, b], styleAttrs());
          }
          finishConstruction();
          setHint(findTool(tool).hint);
          return;
        }

        if (tool === "arc") {
          if (steps < 3) {
            setHint(steps === 1 ? "Tap where the arc starts." : "Tap where the arc ends.");
            return;
          }
          const [center, start, end] = pendingRef.current;
          board.create("arc", [center, start, end], styleAttrs());
          finishConstruction();
          setHint(findTool(tool).hint);
          return;
        }

        if (tool === "triangle") {
          if (steps < 3) {
            setHint(`Tap corner ${steps + 1} of 3.`);
            return;
          }
          board.create("polygon", [...pendingRef.current], {
            borders: styleAttrs(),
            fillColor: "#49734f",
            fillOpacity: 0.08,
          });
          finishConstruction();
          setHint(findTool(tool).hint);
          return;
        }

        if (tool === "rectangle" || tool === "square") {
          if (steps < 2) {
            setHint("Tap the opposite corner.");
            return;
          }
          const [p1, p2] = pendingRef.current;
          const x1 = p1.X?.() ?? 0;
          const y1 = p1.Y?.() ?? 0;
          const x2 = p2.X?.() ?? 0;
          const y2 = p2.Y?.() ?? 0;
          const ax = x1;
          const ay = y1;
          let cx = x2;
          let cy = y2;
          if (tool === "square") {
            const side = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
            cx = x1 + Math.sign(x2 - x1 || 1) * side;
            cy = y1 + Math.sign(y2 - y1 || 1) * side;
          }
          // Hide the second tap point if we recomputed square corner
          if (tool === "square") {
            p2.setAttribute?.({
              visible: false,
              name: "",
            });
          }
          const b = createLabeledPoint(board, cx, ay);
          const d = createLabeledPoint(board, ax, cy);
          const c = tool === "square" ? createLabeledPoint(board, cx, cy) : p2;
          board.create("polygon", [p1, b, c, d], {
            borders: styleAttrs(),
            fillColor: "#49734f",
            fillOpacity: 0.08,
          });
          finishConstruction();
          setHint(findTool(tool).hint);
          return;
        }

        if (tool === "polygon") {
          setHint(`Corners placed: ${steps}. Tap more, or press Done polygon.`);
          return;
        }

        if (tool === "midpoint") {
          if (steps < 2) {
            setHint("Tap the other end of the segment.");
            return;
          }
          const [a, b] = pendingRef.current;
          const name = nextPointName(usedNamesRef.current);
          usedNamesRef.current.add(name);
          board.create("midpoint", [a, b], {
            name,
            size: 4,
            fillColor: "#1a73e8",
            strokeColor: "#174ea6",
            label: { offset: [8, 8], fontSize: 16 },
          });
          finishConstruction();
          setHint(findTool(tool).hint);
          return;
        }

        if (tool === "parallel" || tool === "perpendicular") {
          if (steps < 3) {
            setHint(
              steps === 1
                ? "Tap the second point of the guide line."
                : "Tap the point the new line should pass through.",
            );
            return;
          }
          const [a, b, through] = pendingRef.current;
          const guide = board.create("line", [a, b], { visible: false });
          board.create(tool === "parallel" ? "parallel" : "perpendicular", [guide, through], styleAttrs());
          finishConstruction();
          setHint(findTool(tool).hint);
          return;
        }

        if (tool === "angleBisector") {
          if (steps < 3) {
            setHint(steps === 1 ? "Tap the vertex." : "Tap a point on the other ray.");
            return;
          }
          const [a, vertex, c] = pendingRef.current;
          board.create("bisector", [a, vertex, c], styleAttrs());
          finishConstruction();
          setHint(findTool(tool).hint);
          return;
        }

        if (tool === "intersection") {
          if (steps < 4) {
            const messages = [
              "Tap second point of line 1.",
              "Tap first point of line 2.",
              "Tap second point of line 2.",
            ];
            setHint(messages[steps - 1] || findTool("intersection").hint);
            return;
          }
          const [a, b, c, d] = pendingRef.current;
          const l1 = board.create("line", [a, b], styleAttrs());
          const l2 = board.create("line", [c, d], styleAttrs());
          const name = nextPointName(usedNamesRef.current);
          usedNamesRef.current.add(name);
          board.create("intersection", [l1, l2, 0], {
            name,
            size: 4,
            fillColor: "#c0392b",
            label: { offset: [8, 8], fontSize: 16 },
          });
          finishConstruction();
          setHint(findTool(tool).hint);
          return;
        }

        if (tool === "angle" || tool === "rightAngle" || tool === "angleMeasure") {
          if (steps < 3) {
            setHint(steps === 1 ? "Tap the vertex." : "Tap the third point.");
            return;
          }
          const [a, vertex, c] = pendingRef.current;
          if (tool === "rightAngle") {
            board.create("angle", [a, vertex, c], {
              orthoType: "square",
              orthoSensitivity: 1,
              radius: 0.8,
              fillColor: "#1f2933",
              fillOpacity: 0.15,
            });
          } else if (tool === "angle") {
            board.create("angle", [a, vertex, c], {
              radius: 1,
              fillColor: strokeColor,
              fillOpacity: 0.18,
              label: { visible: true, fontSize: 14 },
            });
          } else {
            setPendingText({
              x: ((a.X?.() ?? 0) + (vertex.X?.() ?? 0) + (c.X?.() ?? 0)) / 3,
              y: ((a.Y?.() ?? 0) + (vertex.Y?.() ?? 0) + (c.Y?.() ?? 0)) / 3,
            });
            setTextDraft("60°");
            board.create("angle", [a, vertex, c], {
              radius: 1,
              fillColor: strokeColor,
              fillOpacity: 0.12,
              label: { visible: false },
            });
            setHint("Type the angle value (e.g. 60°), then tap Add text.");
            resetPending();
            pushHistory();
            return;
          }
          finishConstruction();
          setHint(findTool(tool).hint);
          return;
        }

        if (tool === "length") {
          if (steps < 2) {
            setHint("Tap the other end of the side.");
            return;
          }
          const [a, b] = pendingRef.current;
          board.create("segment", [a, b], styleAttrs());
          const mx = ((a.X?.() ?? 0) + (b.X?.() ?? 0)) / 2;
          const my = ((a.Y?.() ?? 0) + (b.Y?.() ?? 0)) / 2;
          setPendingText({ x: mx, y: my + 0.4 });
          setTextDraft("5 cm");
          setHint("Type the length (e.g. 5 cm), then tap Add text.");
          resetPending();
          pushHistory();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create that object. Try again.");
        resetPending();
      }
    },
    [
      createLabeledPoint,
      finishConstruction,
      pendingText,
      pushHistory,
      resetPending,
      strokeColor,
      styleAttrs,
      tool,
    ],
  );

  const closePolygon = () => {
    const board = boardRef.current;
    if (!board || tool !== "polygon" || pendingRef.current.length < 3) {
      setError("Add at least 3 corners, then tap Done polygon.");
      return;
    }
    try {
      board.create("polygon", [...pendingRef.current], {
        borders: styleAttrs(),
        fillColor: "#49734f",
        fillOpacity: 0.08,
      });
      finishConstruction();
      setHint(findTool("polygon").hint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close the polygon");
    }
  };

  const addPendingText = () => {
    const board = boardRef.current;
    if (!board || !pendingText || !textDraft.trim()) {
      setError("Type some text first.");
      return;
    }
    board.create("text", [pendingText.x, pendingText.y, textDraft.trim()], {
      fontSize: 18,
      strokeColor: "#0f1a12",
      cssClass: "geo-text-label",
      anchorX: "middle",
      anchorY: "middle",
    });
    setPendingText(null);
    setTextDraft("");
    pushHistory();
    setHint(findTool(tool).hint);
    setError("");
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) {
      return;
    }
    historyIndexRef.current -= 1;
    const doc = parseFigureDocument(historyRef.current[historyIndexRef.current]);
    if (doc?.kind === "geometry") {
      rebuildFromDocument(doc);
    }
    syncHistoryButtons();
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) {
      return;
    }
    historyIndexRef.current += 1;
    const doc = parseFigureDocument(historyRef.current[historyIndexRef.current]);
    if (doc?.kind === "geometry") {
      rebuildFromDocument(doc);
    }
    syncHistoryButtons();
  };

  const applyAxisGrid = (nextAxis: boolean, nextGrid: boolean) => {
    const current = snapshotBoard();
    const parsed = parseFigureDocument(current);
    const base: GeometryDocumentV1 =
      parsed?.kind === "geometry"
        ? { ...parsed, axis: nextAxis, grid: nextGrid }
        : {
            version: 1,
            kind: "geometry",
            boundingBox: DEFAULT_BB,
            axis: nextAxis,
            grid: nextGrid,
            jessieCode: "",
          };
    setShowAxis(nextAxis);
    setShowGrid(nextGrid);
    rebuildFromDocument(base);
    pushHistory();
  };

  const handleSave = async () => {
    const board = boardRef.current;
    if (!board) {
      setError("Drawing board is still loading.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const svg = exportSvgMarkup();
      if (!svg) {
        throw new Error("Could not save the diagram. Try again.");
      }
      onInsert({
        src: svgToDataUrl(svg),
        kind: "geometry",
        figureJson: snapshotBoard(),
        figureFormat: "svg",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save geometry");
    } finally {
      setBusy(false);
    }
  };

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="geo-workspace-overlay" role="dialog" aria-modal="true" aria-label="Geometry editor">
      <div className="geo-workspace">
        <header className="geo-workspace__header">
          <div>
            <h2>Geometry</h2>
            <p>Build school diagrams with simple taps — no technical skills needed.</p>
          </div>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close geometry editor">
            ×
          </button>
        </header>

        <div className="geo-workspace__guide" role="status">
          {hint}
          {stepCount > 0 ? <span className="geo-workspace__step"> · Step {stepCount}</span> : null}
        </div>

        <div className="geo-workspace__categories" role="tablist" aria-label="Tool groups">
          {GEOMETRY_CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={category === item.id}
              className={`geo-cat ${category === item.id ? "is-active" : ""}`}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="geo-workspace__tools" role="toolbar" aria-label={activeCategory.label}>
          {activeCategory.tools.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`geo-tool ${tool === item.id ? "is-active" : ""}`}
              title={item.title}
              aria-label={item.title}
              aria-pressed={tool === item.id}
              onClick={() => selectTool(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="geo-workspace__controls">
          <button type="button" className="geo-ctrl" disabled={!canUndo} onClick={handleUndo}>
            Undo
          </button>
          <button type="button" className="geo-ctrl" disabled={!canRedo} onClick={handleRedo}>
            Redo
          </button>
          <button type="button" className="geo-ctrl" onClick={() => boardRef.current?.zoomIn()}>
            Zoom +
          </button>
          <button type="button" className="geo-ctrl" onClick={() => boardRef.current?.zoomOut()}>
            Zoom −
          </button>
          <button
            type="button"
            className="geo-ctrl"
            onClick={() => {
              boardRef.current?.setBoundingBox(DEFAULT_BB, true);
              boardRef.current?.update();
            }}
          >
            Reset
          </button>
          {tool === "polygon" ? (
            <button type="button" className="geo-ctrl geo-ctrl--accent" onClick={closePolygon}>
              Done polygon
            </button>
          ) : null}
        </div>

        <div className="geo-workspace__style" aria-label="Drawing style">
          <span className="geo-workspace__style-label">Color</span>
          {STROKE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`geo-swatch ${strokeColor === color ? "is-active" : ""}`}
              style={{ background: color }}
              aria-label={`Stroke color ${color}`}
              onClick={() => setStrokeColor(color)}
            />
          ))}
          <button
            type="button"
            className={`geo-ctrl ${dashed ? "is-active" : ""}`}
            onClick={() => setDashed((value) => !value)}
          >
            {dashed ? "Dashed" : "Solid"}
          </button>
          <label className="geo-check">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(event) => applyAxisGrid(showAxis, event.target.checked)}
            />
            Grid
          </label>
          <label className="geo-check">
            <input
              type="checkbox"
              checked={showAxis}
              onChange={(event) => applyAxisGrid(event.target.checked, showGrid)}
            />
            Axes
          </label>
        </div>

        <div
          id={boardId}
          className="geo-workspace__board"
          onPointerDown={handleBoardPointer}
        />

        {pendingText ? (
          <div className="geo-text-panel">
            <label htmlFor={`geo-text-${reactId}`}>Text / measurement</label>
            <div className="geo-text-panel__row">
              <input
                id={`geo-text-${reactId}`}
                value={textDraft}
                onChange={(event) => setTextDraft(event.target.value)}
                placeholder="e.g. 5 cm or 60°"
                autoFocus
              />
              <button type="button" className="rte-modal__primary chem-btn" onClick={addPendingText}>
                Add text
              </button>
              <button
                type="button"
                className="rte-modal__ghost chem-btn"
                onClick={() => {
                  setPendingText(null);
                  setTextDraft("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="rte-modal__error geo-workspace__error">{error}</p> : null}

        <footer className="geo-workspace__footer chem-actions">
          <button type="button" className="rte-modal__ghost chem-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="rte-modal__primary chem-btn chem-btn--primary" onClick={handleSave} disabled={busy}>
            {busy ? "Saving…" : "Save Geometry"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default GeometryWorkspace;
