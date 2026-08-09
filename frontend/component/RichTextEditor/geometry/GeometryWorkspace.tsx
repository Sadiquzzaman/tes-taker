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
  collectPointNames,
  createConstrainedRectangle,
  createConstrainedSquare,
  exportBoardSvg,
  findNearestPoint,
  findNearestText,
  lineStyle,
  resolvePointAt,
  type BoardLike,
  type JxgPoint,
  type JxgText,
  type StrokeStyle,
} from "./boardHelpers";
import {
  findTool,
  GEOMETRY_CATEGORIES,
  initialStepFor,
  instructionFor,
  nextPointName,
  type GeometryCategoryId,
  type GeometryToolId,
  type ToolStep,
} from "./toolCatalog";

type GeometryWorkspaceProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (payload: FigureInsertPayload) => void;
  initialDocumentJson?: string | null;
};

const DEFAULT_BB: [number, number, number, number] = [-8, 6, 8, -6];
const COLORS = ["#1f2933", "#49734f", "#c0392b", "#1a73e8", "#8e44ad"];

const GeometryWorkspace = ({ open, onClose, onInsert, initialDocumentJson }: GeometryWorkspaceProps) => {
  const reactId = useId().replace(/:/g, "");
  const boardId = `geo-board-${reactId}`;
  const boardRef = useRef<BoardLike | null>(null);
  const pointsRef = useRef<JxgPoint[]>([]);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const usedNamesRef = useRef<Set<string>>(new Set());
  const selectedRef = useRef<unknown>(null);

  const [category, setCategory] = useState<GeometryCategoryId>("basic");
  const [tool, setTool] = useState<GeometryToolId>("point");
  const [step, setStep] = useState<ToolStep>("await_point_1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAxis, setShowAxis] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#1f2933");
  const [dashed, setDashed] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [textTarget, setTextTarget] = useState<{ x: number; y: number; edit?: JxgText } | null>(null);
  const [selectedLabel, setSelectedLabel] = useState("");

  const style: StrokeStyle = useMemo(
    () => ({ strokeColor, strokeWidth: 2.5, dash: dashed ? 2 : 0 }),
    [dashed, strokeColor],
  );

  const guide = instructionFor(tool, step, pointsRef.current.length);
  const activeCategory = useMemo(
    () => GEOMETRY_CATEGORIES.find((c) => c.id === category) ?? GEOMETRY_CATEGORIES[0],
    [category],
  );

  const syncHistory = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current >= 0 && historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const snapshot = useCallback((): string => {
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
    const snap = snapshot();
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
    syncHistory();
    if (boardRef.current) {
      usedNamesRef.current = collectPointNames(boardRef.current);
    }
  }, [snapshot, syncHistory]);

  const clearPending = useCallback(() => {
    pointsRef.current = [];
  }, []);

  const activateTool = useCallback((next: GeometryToolId) => {
    setTool(next);
    setStep(initialStepFor(next));
    setError("");
    setTextOpen(false);
    setTextTarget(null);
    pointsRef.current = [];
    selectedRef.current = null;
    setSelectedLabel("");
  }, []);

  const completeTool = useCallback(() => {
    pushHistory();
    clearPending();
    const def = findTool(tool);
    if (def.afterComplete === "select") {
      activateTool("select");
    } else {
      setStep(initialStepFor(tool));
    }
  }, [activateTool, clearPending, pushHistory, tool]);

  const rebuild = useCallback(
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
      clearPending();
      selectedRef.current = null;
      setSelectedLabel("");

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
          // keep empty
        }
      }
      usedNamesRef.current = collectPointNames(board);
      board.update();
    },
    [boardId, clearPending],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const parsed = parseFigureDocument(initialDocumentJson);
    const doc: GeometryDocumentV1 =
      parsed?.kind === "geometry"
        ? parsed
        : { version: 1, kind: "geometry", boundingBox: DEFAULT_BB, axis: false, grid: true, jessieCode: "" };
    setShowAxis(doc.axis);
    setShowGrid(doc.grid);
    activateTool("point");
    setCategory("basic");
    setError("");
    const timer = window.setTimeout(() => {
      rebuild(doc);
      historyRef.current = [serializeFigureDocument(doc)];
      historyIndexRef.current = 0;
      syncHistory();
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
  }, [activateTool, initialDocumentJson, open, rebuild, syncHistory]);

  const openTextEditor = (x: number, y: number, draft: string, edit?: JxgText) => {
    setTextTarget({ x, y, edit });
    setTextDraft(draft);
    setTextOpen(true);
    setStep("await_text_input");
  };

  const commitText = () => {
    const board = boardRef.current;
    if (!board || !textTarget || !textDraft.trim()) {
      setError("Type some text first.");
      return;
    }
    if (textTarget.edit) {
      textTarget.edit.setText?.(textDraft.trim());
      textTarget.edit.setAttribute?.({ fontSize: 18 });
    } else {
      board.create("text", [textTarget.x, textTarget.y, textDraft.trim()], {
        fontSize: 18,
        strokeColor: "#0f1a12",
        anchorX: "middle",
        anchorY: "middle",
        cssClass: "geo-text-label",
        fixed: false,
      });
    }
    setTextOpen(false);
    setTextTarget(null);
    setTextDraft("");
    completeTool();
    setError("");
  };

  const handleDeleteSelected = () => {
    const board = boardRef.current;
    const obj = selectedRef.current;
    if (!board || !obj) {
      setError("Tap an object first, then Delete.");
      return;
    }
    try {
      board.removeObject?.(obj);
      selectedRef.current = null;
      setSelectedLabel("");
      pushHistory();
      setError("");
    } catch {
      setError("Could not delete that object.");
    }
  };

  const handlePointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const board = boardRef.current;
      if (!board || textOpen) {
        return;
      }
      event.preventDefault();
      const coords = board.getUsrCoordsOfMouse?.(event.nativeEvent);
      if (!coords || coords.length < 2) {
        return;
      }
      const [x, y] = coords;

      try {
        if (tool === "select" || tool === "delete") {
          const nearText = findNearestText(board, x, y);
          if (nearText) {
            selectedRef.current = nearText;
            setSelectedLabel(nearText.plaintext || "Text");
            if (tool === "select") {
              openTextEditor(nearText.X?.() ?? x, nearText.Y?.() ?? y, nearText.plaintext || "", nearText);
            } else {
              handleDeleteSelected();
            }
            return;
          }
          const nearPoint = findNearestPoint(board, x, y);
          if (nearPoint) {
            selectedRef.current = nearPoint;
            setSelectedLabel(nearPoint.name || "Point");
            if (tool === "delete") {
              handleDeleteSelected();
            }
            return;
          }
          selectedRef.current = null;
          setSelectedLabel("");
          return;
        }

        if (tool === "text") {
          const existing = findNearestText(board, x, y);
          if (existing) {
            openTextEditor(existing.X?.() ?? x, existing.Y?.() ?? y, existing.plaintext || "", existing);
          } else {
            openTextEditor(x, y, "");
          }
          return;
        }

        if (tool === "point") {
          resolvePointAt(board, x, y, usedNamesRef.current);
          completeTool();
          return;
        }

        const { point } = resolvePointAt(board, x, y, usedNamesRef.current);
        pointsRef.current.push(point);
        const n = pointsRef.current.length;

        const need2 = () => {
          if (n < 2) {
            setStep("await_point_2");
            return false;
          }
          return true;
        };
        const need3 = () => {
          if (n < 2) {
            setStep("await_point_2");
            return false;
          }
          if (n < 3) {
            setStep("await_point_3");
            return false;
          }
          return true;
        };
        const need4 = () => {
          if (n < 2) {
            setStep("await_point_2");
            return false;
          }
          if (n < 3) {
            setStep("await_point_3");
            return false;
          }
          if (n < 4) {
            setStep("await_point_4");
            return false;
          }
          return true;
        };

        if (tool === "segment" || tool === "line" || tool === "ray" || tool === "constructionLine") {
          if (!need2()) {
            return;
          }
          const [a, b] = pointsRef.current;
          const attrs = lineStyle(style, tool === "constructionLine");
          if (tool === "segment" || tool === "constructionLine") {
            board.create("segment", [a, b], attrs);
          } else if (tool === "line") {
            board.create("line", [a, b], attrs);
          } else {
            board.create("line", [a, b], { ...attrs, straightFirst: false, straightLast: true });
          }
          completeTool();
          return;
        }

        if (tool === "circle") {
          if (!need2()) {
            return;
          }
          const [center, rim] = pointsRef.current;
          board.create("circle", [center, rim], lineStyle(style));
          completeTool();
          return;
        }

        if (tool === "arc") {
          if (!need3()) {
            return;
          }
          const [center, start, end] = pointsRef.current;
          board.create("arc", [center, start, end], lineStyle(style));
          completeTool();
          return;
        }

        if (tool === "triangle") {
          if (!need3()) {
            return;
          }
          board.create("polygon", [...pointsRef.current], {
            borders: lineStyle(style),
            fillColor: "#49734f",
            fillOpacity: 0.08,
          });
          completeTool();
          return;
        }

        if (tool === "rectangle") {
          if (!need2()) {
            return;
          }
          const [a, c] = pointsRef.current;
          createConstrainedRectangle(board, a, c, style);
          completeTool();
          return;
        }

        if (tool === "square") {
          if (!need2()) {
            return;
          }
          const [a, b] = pointsRef.current;
          createConstrainedSquare(board, a, b, style);
          completeTool();
          return;
        }

        if (tool === "polygon") {
          setStep("await_polygon_more");
          return;
        }

        if (tool === "midpoint" || tool === "perpBisector" || tool === "chord" || tool === "length") {
          if (!need2()) {
            return;
          }
          const [a, b] = pointsRef.current;
          if (tool === "midpoint") {
            const name = nextPointName(usedNamesRef.current);
            usedNamesRef.current.add(name);
            board.create("midpoint", [a, b], {
              name,
              size: 4,
              fillColor: "#1a73e8",
              label: { offset: [10, 10], fontSize: 16 },
            });
            completeTool();
            return;
          }
          if (tool === "perpBisector") {
            board.create("perpendicularbisector", [a, b], lineStyle(style, true));
            completeTool();
            return;
          }
          if (tool === "chord") {
            board.create("segment", [a, b], lineStyle(style));
            completeTool();
            return;
          }
          // length
          board.create("segment", [a, b], lineStyle(style));
          const mx = ((a.X?.() ?? 0) + (b.X?.() ?? 0)) / 2;
          const my = ((a.Y?.() ?? 0) + (b.Y?.() ?? 0)) / 2 + 0.45;
          const label = `${a.name || "A"}${b.name || "B"} = 5 cm`;
          openTextEditor(mx, my, label);
          clearPending();
          pushHistory();
          return;
        }

        if (tool === "parallel" || tool === "perpendicular") {
          if (!need3()) {
            return;
          }
          const [a, b, through] = pointsRef.current;
          const guideLine = board.create("line", [a, b], { visible: false });
          board.create(tool === "parallel" ? "parallel" : "perpendicular", [guideLine, through], lineStyle(style));
          completeTool();
          return;
        }

        if (tool === "angleBisector") {
          if (!need3()) {
            return;
          }
          const [a, vertex, c] = pointsRef.current;
          board.create("bisector", [a, vertex, c], lineStyle(style));
          completeTool();
          return;
        }

        if (tool === "intersection") {
          if (!need4()) {
            return;
          }
          const [a, b, c, d] = pointsRef.current;
          const l1 = board.create("line", [a, b], lineStyle(style));
          const l2 = board.create("line", [c, d], lineStyle(style));
          const name = nextPointName(usedNamesRef.current);
          usedNamesRef.current.add(name);
          board.create("intersection", [l1, l2, 0], {
            name,
            size: 4,
            fillColor: "#c0392b",
            label: { offset: [10, 10], fontSize: 16 },
          });
          completeTool();
          return;
        }

        if (tool === "tangent") {
          if (!need2()) {
            return;
          }
          const [center, onCircle] = pointsRef.current;
          const circle = board.create("circle", [center, onCircle], { visible: false });
          board.create("tangent", [onCircle, circle], lineStyle(style));
          // Also show the circle so tangent is meaningful
          board.create("circle", [center, onCircle], lineStyle(style));
          completeTool();
          return;
        }

        if (tool === "angle" || tool === "rightAngle" || tool === "angleLabel") {
          if (!need3()) {
            return;
          }
          const [a, vertex, c] = pointsRef.current;
          if (tool === "rightAngle") {
            board.create("angle", [a, vertex, c], {
              orthoType: "square",
              orthoSensitivity: 1,
              radius: 0.85,
              fillColor: "#1f2933",
              fillOpacity: 0.2,
            });
            completeTool();
            return;
          }
          if (tool === "angle") {
            board.create("angle", [a, vertex, c], {
              radius: 1,
              fillColor: strokeColor,
              fillOpacity: 0.18,
              label: { visible: true, fontSize: 14 },
            });
            completeTool();
            return;
          }
          board.create("angle", [a, vertex, c], {
            radius: 1,
            fillColor: strokeColor,
            fillOpacity: 0.12,
            label: { visible: false },
          });
          openTextEditor(
            ((a.X?.() ?? 0) + (vertex.X?.() ?? 0) + (c.X?.() ?? 0)) / 3,
            ((a.Y?.() ?? 0) + (vertex.Y?.() ?? 0) + (c.Y?.() ?? 0)) / 3,
            "60°",
          );
          clearPending();
          pushHistory();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not complete that step. Try again.");
        clearPending();
        setStep(initialStepFor(tool));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers closed over latest tool/step via refs+state
    [clearPending, completeTool, pushHistory, strokeColor, style, textOpen, tool],
  );

  const finishPolygon = () => {
    const board = boardRef.current;
    if (!board || pointsRef.current.length < 3) {
      setError("Add at least 3 corners, then tap Finish polygon.");
      return;
    }
    board.create("polygon", [...pointsRef.current], {
      borders: lineStyle(style),
      fillColor: "#49734f",
      fillOpacity: 0.08,
    });
    completeTool();
    setError("");
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) {
      return;
    }
    historyIndexRef.current -= 1;
    const doc = parseFigureDocument(historyRef.current[historyIndexRef.current]);
    if (doc?.kind === "geometry") {
      rebuild(doc);
    }
    syncHistory();
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) {
      return;
    }
    historyIndexRef.current += 1;
    const doc = parseFigureDocument(historyRef.current[historyIndexRef.current]);
    if (doc?.kind === "geometry") {
      rebuild(doc);
    }
    syncHistory();
  };

  const applyAxisGrid = (axis: boolean, grid: boolean) => {
    const current = snapshot();
    const parsed = parseFigureDocument(current);
    const base: GeometryDocumentV1 =
      parsed?.kind === "geometry"
        ? { ...parsed, axis, grid }
        : { version: 1, kind: "geometry", boundingBox: DEFAULT_BB, axis, grid, jessieCode: "" };
    setShowAxis(axis);
    setShowGrid(grid);
    rebuild(base);
    pushHistory();
  };

  const handleSave = async () => {
    const board = boardRef.current;
    if (!board) {
      setError("Board is still loading.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const svg = exportBoardSvg(board);
      if (!svg) {
        throw new Error("Could not save the diagram.");
      }
      onInsert({
        src: svgToDataUrl(svg),
        kind: "geometry",
        figureJson: snapshot(),
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
            <p>Build constructions step by step — tap existing points to connect them.</p>
          </div>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="geo-workspace__guide" role="status">
          {guide}
        </div>

        <div className="geo-workspace__categories" role="tablist">
          {GEOMETRY_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={category === cat.id}
              className={`geo-cat ${category === cat.id ? "is-active" : ""}`}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="geo-workspace__tools" role="toolbar">
          {activeCategory.tools.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`geo-tool ${tool === item.id ? "is-active" : ""}`}
              title={item.title}
              aria-pressed={tool === item.id}
              onClick={() => activateTool(item.id)}
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
            Reset view
          </button>
          {tool === "polygon" ? (
            <button type="button" className="geo-ctrl geo-ctrl--accent" onClick={finishPolygon}>
              Finish polygon
            </button>
          ) : null}
          <button type="button" className="geo-ctrl" onClick={handleDeleteSelected} disabled={!selectedLabel}>
            Delete{selectedLabel ? `: ${selectedLabel}` : ""}
          </button>
        </div>

        <div className="geo-workspace__style">
          <span className="geo-workspace__style-label">Style</span>
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`geo-swatch ${strokeColor === color ? "is-active" : ""}`}
              style={{ background: color }}
              aria-label={`Color ${color}`}
              onClick={() => setStrokeColor(color)}
            />
          ))}
          <button type="button" className={`geo-ctrl ${dashed ? "is-active" : ""}`} onClick={() => setDashed((v) => !v)}>
            {dashed ? "Dashed" : "Solid"}
          </button>
          <label className="geo-check">
            <input type="checkbox" checked={showGrid} onChange={(e) => applyAxisGrid(showAxis, e.target.checked)} />
            Grid
          </label>
          <label className="geo-check">
            <input type="checkbox" checked={showAxis} onChange={(e) => applyAxisGrid(e.target.checked, showGrid)} />
            Axes
          </label>
        </div>

        <div id={boardId} className="geo-workspace__board" onPointerDown={handlePointer} />

        {textOpen ? (
          <div className="geo-text-panel">
            <label htmlFor={`geo-text-${reactId}`}>Text on diagram</label>
            <div className="geo-text-panel__row">
              <input
                id={`geo-text-${reactId}`}
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder="e.g. 5 cm, 60°, Triangle ABC"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitText();
                  }
                }}
              />
              <button type="button" className="rte-modal__primary chem-btn" onClick={commitText}>
                Done
              </button>
              <button
                type="button"
                className="rte-modal__ghost chem-btn"
                onClick={() => {
                  setTextOpen(false);
                  setTextTarget(null);
                  activateTool("select");
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
          <button
            type="button"
            className="rte-modal__primary chem-btn chem-btn--primary"
            onClick={handleSave}
            disabled={busy}
          >
            {busy ? "Saving…" : "Insert into Question"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default GeometryWorkspace;
