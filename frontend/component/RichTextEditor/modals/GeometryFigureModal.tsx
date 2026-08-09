"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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

type GeometryTool =
  | "select"
  | "point"
  | "segment"
  | "line"
  | "ray"
  | "circle"
  | "ellipse"
  | "polygon"
  | "angle"
  | "midpoint"
  | "perpendicular"
  | "parallel"
  | "label";

type GeometryFigureModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (payload: FigureInsertPayload) => void;
  initialDocumentJson?: string | null;
};

type BoardLike = {
  create: (type: string, parents: unknown[], attributes?: Record<string, unknown>) => unknown;
  select: (objects?: unknown[] | null, add?: boolean) => void;
  getBoundingBox: () => [number, number, number, number];
  setBoundingBox: (bb: [number, number, number, number], keepaspectratio?: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  moveOrigin: (x: number, y: number) => void;
  update: () => void;
  jc?: { parse: (code: string) => void };
  containerObj?: HTMLElement;
  objectsList?: unknown[];
  defaultAxes?: unknown;
};

const DEFAULT_BB: [number, number, number, number] = [-8, 6, 8, -6];

const TOOL_GROUPS: { label: string; tools: { id: GeometryTool; label: string; title: string }[] }[] = [
  {
    label: "Tools",
    tools: [
      { id: "select", label: "Select", title: "Select / drag" },
      { id: "point", label: "Point", title: "Create point" },
      { id: "label", label: "Label", title: "Add text label" },
    ],
  },
  {
    label: "Lines",
    tools: [
      { id: "segment", label: "Segment", title: "Line segment (2 points)" },
      { id: "line", label: "Line", title: "Infinite line (2 points)" },
      { id: "ray", label: "Ray", title: "Ray (2 points)" },
      { id: "perpendicular", label: "⊥", title: "Perpendicular through point to line" },
      { id: "parallel", label: "∥", title: "Parallel through point to line" },
      { id: "midpoint", label: "Mid", title: "Midpoint of segment / 2 points" },
    ],
  },
  {
    label: "Shapes",
    tools: [
      { id: "circle", label: "Circle", title: "Circle (center + point)" },
      { id: "ellipse", label: "Ellipse", title: "Ellipse (3 points)" },
      { id: "polygon", label: "Polygon", title: "Polygon (click points, double-click to close)" },
      { id: "angle", label: "∠", title: "Angle (3 points)" },
    ],
  },
];

const isPointEl = (el: unknown): boolean => {
  const type = (el as { elType?: string; type?: number })?.elType;
  return type === "point" || type === "glider" || type === "midpoint";
};

const GeometryFigureModal = ({ open, onClose, onInsert, initialDocumentJson }: GeometryFigureModalProps) => {
  const reactId = useId().replace(/:/g, "");
  const boardId = `jxg-board-${reactId}`;
  const boardRef = useRef<BoardLike | null>(null);
  const pendingRef = useRef<unknown[]>([]);
  const polygonPointsRef = useRef<unknown[]>([]);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const [tool, setTool] = useState<GeometryTool>("point");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAxis, setShowAxis] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryButtons = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current >= 0 && historyIndexRef.current < historyRef.current.length - 1);
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
    if (next.length > 40) {
      next.shift();
    }
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    syncHistoryButtons();
  }, [snapshotBoard, syncHistoryButtons]);

  const exportSvgMarkup = useCallback((): string | null => {
    const board = boardRef.current;
    const host = board?.containerObj;
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
      polygonPointsRef.current = [];

        const board = JXG.JSXGraph.initBoard(boardId, {
        boundingbox: doc.boundingBox ?? DEFAULT_BB,
        axis: doc.axis,
        grid: doc.grid,
        showCopyright: false,
        showNavigation: false,
        pan: { enabled: true, needTwoFingers: false },
        zoom: { wheel: true },
        keepaspectratio: true,
      } as never) as unknown as BoardLike;
      boardRef.current = board;

      if (doc.jessieCode?.trim() && board.jc?.parse) {
        try {
          board.jc.parse(doc.jessieCode);
        } catch {
          // Jessie parse can fail on older dumps — keep empty board
        }
      }
      board.update();
    },
    [boardId],
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
            axis: true,
            grid: true,
            jessieCode: "",
          };

    setShowAxis(doc.axis);
    setShowGrid(doc.grid);
    setError("");
    setTool("point");

    const timer = window.setTimeout(() => {
      rebuildFromDocument(doc);
      historyRef.current = [serializeFigureDocument(doc)];
      historyIndexRef.current = 0;
      syncHistoryButtons();
    }, 30);

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

  useEffect(() => {
    if (!open || !boardRef.current) {
      return;
    }
    // Recreate board when axis/grid toggles change after init
  }, [open, showAxis, showGrid]);

  const handleBoardClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const board = boardRef.current as BoardLike & {
        getUsrCoordsOfMouse?: (ev: MouseEvent) => number[];
      };
      if (!board || tool === "select") {
        return;
      }

      const coords =
        typeof board.getUsrCoordsOfMouse === "function"
          ? board.getUsrCoordsOfMouse(event.nativeEvent)
          : null;
      if (!coords || coords.length < 2) {
        return;
      }
      const [x, y] = coords;
      setError("");

      try {
        if (tool === "point") {
          board.create("point", [x, y], { name: "", size: 3 });
          pushHistory();
          return;
        }

        if (tool === "label") {
          const text = window.prompt("Label text", "A");
          if (!text?.trim()) {
            return;
          }
          board.create("text", [x, y, text.trim()], { fontSize: 16, cssClass: "jxg-label" });
          pushHistory();
          return;
        }

        const point = board.create("point", [x, y], { name: "", size: 3 });

        if (tool === "segment" || tool === "line" || tool === "ray" || tool === "circle") {
          pendingRef.current.push(point);
          if (pendingRef.current.length < 2) {
            return;
          }
          const [a, b] = pendingRef.current;
          pendingRef.current = [];
          if (tool === "segment") {
            board.create("segment", [a, b], { strokeWidth: 2 });
          } else if (tool === "line") {
            board.create("line", [a, b], { strokeWidth: 2 });
          } else if (tool === "ray") {
            board.create("line", [a, b], { straightFirst: false, straightLast: true, strokeWidth: 2 });
          } else {
            board.create("circle", [a, b], { strokeWidth: 2 });
          }
          pushHistory();
          return;
        }

        if (tool === "ellipse" || tool === "angle") {
          pendingRef.current.push(point);
          if (pendingRef.current.length < 3) {
            return;
          }
          const [a, b, c] = pendingRef.current;
          pendingRef.current = [];
          if (tool === "ellipse") {
            board.create("ellipse", [a, b, c], { strokeWidth: 2 });
          } else {
            board.create("angle", [a, b, c], { radius: 1 });
          }
          pushHistory();
          return;
        }

        if (tool === "midpoint") {
          pendingRef.current.push(point);
          if (pendingRef.current.length < 2) {
            return;
          }
          const [a, b] = pendingRef.current;
          pendingRef.current = [];
          board.create("midpoint", [a, b], { name: "M", size: 3 });
          pushHistory();
          return;
        }

        if (tool === "perpendicular" || tool === "parallel") {
          pendingRef.current.push(point);
          if (pendingRef.current.length === 1) {
            setError("Now click a line (or create the second point of a reference line).");
            return;
          }
          if (pendingRef.current.length === 2 && isPointEl(pendingRef.current[1])) {
            // second click was another point — build a temporary line then construction
            const line = board.create("line", [pendingRef.current[0], pendingRef.current[1]], {
              visible: false,
            });
            const through = pendingRef.current[0];
            pendingRef.current = [];
            board.create(tool === "perpendicular" ? "perpendicular" : "parallel", [line, through], {
              strokeWidth: 2,
            });
            pushHistory();
            return;
          }
          return;
        }

        if (tool === "polygon") {
          polygonPointsRef.current.push(point);
          if (polygonPointsRef.current.length >= 3) {
            setError("Double-click the board to close the polygon.");
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create geometry object");
        pendingRef.current = [];
      }
    },
    [pushHistory, tool],
  );

  const handleBoardDoubleClick = useCallback(() => {
    const board = boardRef.current;
    if (!board || tool !== "polygon" || polygonPointsRef.current.length < 3) {
      return;
    }
    try {
      board.create("polygon", [...polygonPointsRef.current], { borders: { strokeWidth: 2 } });
      polygonPointsRef.current = [];
      setError("");
      pushHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create polygon");
    }
  }, [pushHistory, tool]);

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) {
      return;
    }
    historyIndexRef.current -= 1;
    const snap = historyRef.current[historyIndexRef.current];
    const doc = parseFigureDocument(snap);
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
    const snap = historyRef.current[historyIndexRef.current];
    const doc = parseFigureDocument(snap);
    if (doc?.kind === "geometry") {
      rebuildFromDocument(doc);
    }
    syncHistoryButtons();
  };

  const handleZoom = (dir: "in" | "out" | "reset") => {
    const board = boardRef.current;
    if (!board) {
      return;
    }
    if (dir === "in") {
      board.zoomIn();
    } else if (dir === "out") {
      board.zoomOut();
    } else {
      board.setBoundingBox(DEFAULT_BB, true);
    }
    board.update();
  };

  const handleInsert = async () => {
    const board = boardRef.current;
    if (!board) {
      setError("Board is not ready.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const svg = exportSvgMarkup();
      if (!svg) {
        throw new Error("Could not export SVG from the geometry board.");
      }
      const figureJson = snapshotBoard();
      onInsert({
        src: svgToDataUrl(svg),
        kind: "geometry",
        figureJson,
        figureFormat: "svg",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to insert geometry figure");
    } finally {
      setBusy(false);
    }
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

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="rte-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="rte-modal rte-modal--wide rte-figure-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Insert geometry figure"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="rte-modal__header">
          <h3>Insert geometry figure</h3>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="rte-modal__hint">
          Build constructions with points, lines, circles, polygons, and angles. Drag objects freely. Export saves SVG
          plus editable JSON.
        </p>

        <div className="rte-figure-toolbar">
          {TOOL_GROUPS.map((group) => (
            <div key={group.label} className="rte-figure-toolbar__group">
              <span className="rte-figure-toolbar__label">{group.label}</span>
              <div className="rte-modal__chips">
                {group.tools.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={item.title}
                    className={`rte-modal__chip ${tool === item.id ? "is-active" : ""}`}
                    onClick={() => {
                      setTool(item.id);
                      pendingRef.current = [];
                      polygonPointsRef.current = [];
                      setError("");
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rte-modal__row rte-figure-controls">
          <label className="rte-modal__check">
            <input
              type="checkbox"
              checked={showAxis}
              onChange={(event) => applyAxisGrid(event.target.checked, showGrid)}
            />
            Axes
          </label>
          <label className="rte-modal__check">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(event) => applyAxisGrid(showAxis, event.target.checked)}
            />
            Grid
          </label>
          <button type="button" className="rte-modal__chip" disabled={!canUndo} onClick={handleUndo}>
            Undo
          </button>
          <button type="button" className="rte-modal__chip" disabled={!canRedo} onClick={handleRedo}>
            Redo
          </button>
          <button type="button" className="rte-modal__chip" onClick={() => handleZoom("in")}>
            Zoom +
          </button>
          <button type="button" className="rte-modal__chip" onClick={() => handleZoom("out")}>
            Zoom −
          </button>
          <button type="button" className="rte-modal__chip" onClick={() => handleZoom("reset")}>
            Reset view
          </button>
        </div>

        <div
          id={boardId}
          className="rte-jsxgraph-host"
          onClick={handleBoardClick}
          onDoubleClick={handleBoardDoubleClick}
        />

        {error ? <p className="rte-modal__error">{error}</p> : null}

        <div className="rte-modal__actions rte-modal__actions--sticky">
          <button type="button" className="rte-modal__ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="rte-modal__primary" onClick={handleInsert} disabled={busy}>
            {busy ? "Saving…" : "Insert figure"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default GeometryFigureModal;
