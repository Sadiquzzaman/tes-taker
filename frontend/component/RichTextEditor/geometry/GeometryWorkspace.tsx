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
  applySelectionHighlight,
  clearSelectionHighlight,
  collectPointNames,
  createCircleByDiameter,
  createCircleCenterRadius,
  exportBoardSvg,
  findNearestPoint,
  findSelectableAt,
  getShapeDragPoints,
  isCircle,
  isDragShapeTool,
  isPoint,
  isText,
  lineStyle,
  movePointTo,
  moveTextTo,
  resolvePointAt,
  revealCircleCenter,
  startDragShape,
  translatePoints,
  userCoordsToBoardPixels,
  type BoardLike,
  type JxgPoint,
  type JxgText,
  type SelectableObject,
  type StrokeStyle,
} from "./boardHelpers";
import {
  CIRCLE_MODES,
  contextualActionsFor,
  findTool,
  initialStepFor,
  instructionFor,
  nextPointName,
  TOOLBAR_TABS,
  toolsForTab,
  type CircleCreateMode,
  type ContextualActionId,
  type GeometryToolId,
  type ToolbarTab,
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
const SNAP_CLOSE = 0.55;

const GeometryWorkspace = ({ open, onClose, onInsert, initialDocumentJson }: GeometryWorkspaceProps) => {
  const reactId = useId().replace(/:/g, "");
  const boardId = `geo-board-${reactId}`;
  const boardRef = useRef<BoardLike | null>(null);
  const pointsRef = useRef<JxgPoint[]>([]);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const usedNamesRef = useRef<Set<string>>(new Set());
  const selectedRef = useRef<SelectableObject | null>(null);
  const boardHostRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ end: JxgPoint; pointerId: number } | null>(null);
  const shapeMoveRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    moved: boolean;
    points: JxgPoint[];
    text?: JxgText;
  } | null>(null);
  const pointDragPendingRef = useRef(false);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const styleRef = useRef<StrokeStyle>({ strokeColor: "#1f2933", strokeWidth: 2.5, dash: 0 });

  const [tab, setTab] = useState<ToolbarTab>("draw");
  const [tool, setTool] = useState<GeometryToolId>("select");
  const [circleMode, setCircleMode] = useState<CircleCreateMode>("centerRadius");
  const [step, setStep] = useState<ToolStep>("idle");
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
  const [textPixel, setTextPixel] = useState<{ left: number; top: number } | null>(null);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [selectedKind, setSelectedKind] = useState<SelectableObject["kind"] | "">("");
  const [pendingCtx, setPendingCtx] = useState<ContextualActionId | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);

  const style: StrokeStyle = useMemo(() => {
    const next = { strokeColor, strokeWidth: 2.5, dash: dashed ? 2 : 0 };
    styleRef.current = next;
    return next;
  }, [dashed, strokeColor]);

  const guide = instructionFor(tool, step, {
    circleMode,
    polygonCount: pointsRef.current.length,
    hasSelection: Boolean(selectedLabel),
  });

  const tabTools = useMemo(() => toolsForTab(tab), [tab]);
  const ctxActions = useMemo(
    () => (selectedKind ? contextualActionsFor(selectedKind) : []),
    [selectedKind],
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

  const clearSelection = useCallback(() => {
    if (selectedRef.current) {
      clearSelectionHighlight(selectedRef.current.el);
    }
    selectedRef.current = null;
    setSelectedLabel("");
    setSelectedKind("");
    setPendingCtx(null);
    setRenameOpen(false);
  }, []);

  const setSelection = useCallback(
    (sel: SelectableObject | null) => {
      if (selectedRef.current) {
        clearSelectionHighlight(selectedRef.current.el);
      }
      selectedRef.current = sel;
      if (sel) {
        applySelectionHighlight(sel.el);
        setSelectedLabel(sel.label);
        setSelectedKind(sel.kind);
      } else {
        setSelectedLabel("");
        setSelectedKind("");
      }
      setPendingCtx(null);
    },
    [],
  );

  const activateTool = useCallback(
    (next: GeometryToolId) => {
      setTool(next);
      setStep(initialStepFor(next, circleMode));
      setError("");
      setTextOpen(false);
      setTextTarget(null);
      setTextPixel(null);
      setTextDraft("");
      pointsRef.current = [];
      dragRef.current = null;
      setPendingCtx(null);
      if (next !== "select") {
        clearSelection();
      }
    },
    [circleMode, clearSelection],
  );

  const completeTool = useCallback(() => {
    pushHistory();
    clearPending();
    const def = findTool(tool);
    if (def.afterComplete === "select") {
      activateTool("select");
      setTab("draw");
    } else {
      setStep(initialStepFor(tool, circleMode));
    }
  }, [activateTool, circleMode, clearPending, pushHistory, tool]);

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
      setSelectedKind("");

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
    activateTool("select");
    setTab("draw");
    setCircleMode("centerRadius");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/reset once per open cycle
  }, [initialDocumentJson, open, rebuild, syncHistory]);

  const openTextEditor = (x: number, y: number, draft: string, edit?: JxgText) => {
    const board = boardRef.current;
    const host = boardHostRef.current;
    setTextTarget({ x, y, edit });
    setTextDraft(draft);
    setTextOpen(true);
    setStep("await_text_input");
    if (board && host) {
      setTextPixel(userCoordsToBoardPixels(board, host, x, y));
    } else {
      setTextPixel({ left: 40, top: 40 });
    }
    window.setTimeout(() => textInputRef.current?.focus(), 40);
  };

  const commitText = () => {
    const board = boardRef.current;
    if (!board || !textTarget) {
      setTextOpen(false);
      setTextTarget(null);
      setTextPixel(null);
      return;
    }
    const value = textDraft.trim();
    if (!value) {
      setTextOpen(false);
      setTextTarget(null);
      setTextPixel(null);
      setTextDraft("");
      activateTool("select");
      return;
    }
    if (textTarget.edit) {
      textTarget.edit.setText?.(value);
      textTarget.edit.setAttribute?.({ fontSize: 18 });
    } else {
      board.create("text", [textTarget.x, textTarget.y, value], {
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
    setTextPixel(null);
    setTextDraft("");
    setError("");
    pushHistory();
    activateTool("select");
  };

  const cancelText = () => {
    setTextOpen(false);
    setTextTarget(null);
    setTextPixel(null);
    setTextDraft("");
    activateTool("select");
  };

  const handleDeleteSelected = useCallback(() => {
    const board = boardRef.current;
    const sel = selectedRef.current;
    if (!board || !sel) {
      setError("Tap an object first, then Delete.");
      return;
    }
    try {
      clearSelectionHighlight(sel.el);
      board.removeObject?.(sel.el);
      selectedRef.current = null;
      setSelectedLabel("");
      setSelectedKind("");
      pushHistory();
      setError("");
    } catch {
      setError("Could not delete that object.");
    }
  }, [pushHistory]);

  const runContextual = useCallback(
    (action: ContextualActionId) => {
      const board = boardRef.current;
      const sel = selectedRef.current;
      if (!board || !sel) {
        return;
      }
      try {
        if (action === "delete") {
          handleDeleteSelected();
          return;
        }
        if (action === "editText" && isText(sel.el)) {
          openTextEditor(sel.el.X?.() ?? 0, sel.el.Y?.() ?? 0, sel.el.plaintext || "", sel.el);
          return;
        }
        if (action === "label") {
          if (isPoint(sel.el)) {
            setRenameDraft(sel.el.name || "A");
            setRenameOpen(true);
            return;
          }
          const cx =
            isCircle(sel.el) && sel.el.center
              ? (sel.el.center.X?.() ?? 0)
              : ((sel.el as JxgPoint).X?.() ?? 0);
          const cy =
            isCircle(sel.el) && sel.el.center
              ? (sel.el.center.Y?.() ?? 0) + (sel.el.Radius?.() ?? 1) * 0.3
              : ((sel.el as JxgPoint).Y?.() ?? 0);
          openTextEditor(cx, cy + 0.4, "");
          return;
        }
        if (sel.kind === "circle" && isCircle(sel.el) && action === "center") {
          revealCircleCenter(board, sel.el, usedNamesRef.current);
          pushHistory();
          return;
        }
        if (sel.kind === "segment") {
          const line = sel.el as { point1?: JxgPoint; point2?: JxgPoint };
          if (action === "length" && line.point1 && line.point2) {
            const mx = ((line.point1.X?.() ?? 0) + (line.point2.X?.() ?? 0)) / 2;
            const my = ((line.point1.Y?.() ?? 0) + (line.point2.Y?.() ?? 0)) / 2 + 0.45;
            const n1 = line.point1.name || "A";
            const n2 = line.point2.name || "B";
            openTextEditor(mx, my, `${n1}${n2} = 5 cm`);
            return;
          }
          if (action === "midpoint" && line.point1 && line.point2) {
            const name = nextPointName(usedNamesRef.current);
            usedNamesRef.current.add(name);
            board.create("midpoint", [line.point1, line.point2], {
              name,
              size: 4,
              fillColor: "#1a73e8",
              label: { offset: [10, 10], fontSize: 16 },
            });
            pushHistory();
            return;
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not run that action.");
      }
    },
    [handleDeleteSelected, pushHistory],
  );

  const readBoardCoords = (event: MouseEvent | TouchEvent | PointerEvent): [number, number] | null => {
    const board = boardRef.current;
    const coords = board?.getUsrCoordsOfMouse?.(event);
    if (!coords || coords.length < 2) {
      return null;
    }
    return [coords[0], coords[1]];
  };

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const board = boardRef.current;
      if (!board || textOpen) {
        return;
      }
      const pair = readBoardCoords(event.nativeEvent);
      if (!pair) {
        return;
      }
      const [x, y] = pair;
      const s = styleRef.current;

      if (isDragShapeTool(tool, circleMode)) {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        try {
          const snapStart = tool === "segment" || tool === "constructionLine" ? findNearestPoint(board, x, y) : null;
          const sx = snapStart?.X?.() ?? x;
          const sy = snapStart?.Y?.() ?? y;
          const dragTool =
            tool === "constructionLine" ? "constructionLine" : tool === "circle" ? "circle" : (tool as "rectangle" | "square" | "segment");
          const { end } = startDragShape(board, dragTool, sx, sy, s, usedNamesRef.current, {
            dashed: tool === "constructionLine" || dashed,
            snapStart,
          });
          dragRef.current = { end, pointerId: event.pointerId };
          setStep("await_point_2");
          setError("");
        } catch (err) {
          dragRef.current = null;
          setError(err instanceof Error ? err.message : "Could not start shape.");
        }
        return;
      }

      try {
        if (tool === "select" || tool === "delete") {
          const hit = findSelectableAt(board, x, y);
          if (hit) {
            setSelection(hit);
            if (tool === "delete") {
              event.preventDefault();
              handleDeleteSelected();
              return;
            }
            // Let JSXGraph drag individual points natively.
            if (hit.kind === "point") {
              pointDragPendingRef.current = true;
              return;
            }
            // Whole-shape / text drag (Word-like move).
            if (hit.kind === "text" && isText(hit.el)) {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              shapeMoveRef.current = {
                pointerId: event.pointerId,
                lastX: x,
                lastY: y,
                moved: false,
                points: [],
                text: hit.el,
              };
              return;
            }
            const points = getShapeDragPoints(hit);
            if (points.length === 0) {
              return;
            }
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            shapeMoveRef.current = {
              pointerId: event.pointerId,
              lastX: x,
              lastY: y,
              moved: false,
              points,
            };
            return;
          }
          event.preventDefault();
          clearSelection();
          return;
        }

        event.preventDefault();

        if (tool === "text") {
          const hit = findSelectableAt(board, x, y);
          if (hit?.kind === "text" && isText(hit.el)) {
            openTextEditor(hit.el.X?.() ?? x, hit.el.Y?.() ?? y, hit.el.plaintext || "", hit.el);
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

        // Circle by diameter or center+radius (tap mode)
        if (tool === "circle" && circleMode !== "drag") {
          const { point } = resolvePointAt(board, x, y, usedNamesRef.current);
          pointsRef.current.push(point);
          if (pointsRef.current.length < 2) {
            setStep("await_point_2");
            return;
          }
          const [a, b] = pointsRef.current;
          if (circleMode === "diameter") {
            createCircleByDiameter(board, a, b, s, usedNamesRef.current);
          } else {
            createCircleCenterRadius(board, a, b, s);
          }
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
          const attrs = lineStyle(s, tool === "constructionLine");
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

        if (tool === "arc") {
          if (!need3()) {
            return;
          }
          const [center, start, end] = pointsRef.current;
          board.create("arc", [center, start, end], lineStyle(s));
          completeTool();
          return;
        }

        if (tool === "triangle") {
          if (!need3()) {
            return;
          }
          board.create("polygon", [...pointsRef.current], {
            borders: lineStyle(s),
            fillColor: "#49734f",
            fillOpacity: 0.08,
          });
          completeTool();
          return;
        }

        if (tool === "polygon") {
          // Close if tapping near first point with ≥3 corners
          if (n >= 3) {
            const first = pointsRef.current[0];
            const last = pointsRef.current[n - 1];
            if (
              first !== last &&
              typeof first.X === "function" &&
              typeof last.X === "function" &&
              Math.hypot(first.X() - last.X(), (first.Y?.() ?? 0) - (last.Y?.() ?? 0)) < SNAP_CLOSE
            ) {
              pointsRef.current.pop();
              board.create("polygon", [...pointsRef.current], {
                borders: lineStyle(s),
                fillColor: "#49734f",
                fillOpacity: 0.08,
              });
              completeTool();
              return;
            }
          }
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
            board.create("perpendicularbisector", [a, b], lineStyle(s, true));
            completeTool();
            return;
          }
          if (tool === "chord") {
            board.create("segment", [a, b], lineStyle(s));
            completeTool();
            return;
          }
          board.create("segment", [a, b], lineStyle(s));
          const mx = ((a.X?.() ?? 0) + (b.X?.() ?? 0)) / 2;
          const my = ((a.Y?.() ?? 0) + (b.Y?.() ?? 0)) / 2 + 0.45;
          openTextEditor(mx, my, `${a.name || "A"}${b.name || "B"} = 5 cm`);
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
          board.create(tool === "parallel" ? "parallel" : "perpendicular", [guideLine, through], lineStyle(s));
          completeTool();
          return;
        }

        if (tool === "angleBisector") {
          if (!need3()) {
            return;
          }
          const [a, vertex, c] = pointsRef.current;
          board.create("bisector", [a, vertex, c], lineStyle(s));
          completeTool();
          return;
        }

        if (tool === "intersection") {
          if (!need4()) {
            return;
          }
          const [a, b, c, d] = pointsRef.current;
          const l1 = board.create("line", [a, b], lineStyle(s));
          const l2 = board.create("line", [c, d], lineStyle(s));
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
          board.create("tangent", [onCircle, circle], lineStyle(s));
          board.create("circle", [center, onCircle], lineStyle(s));
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
        setStep(initialStepFor(tool, circleMode));
      }
    },
    [circleMode, clearPending, clearSelection, completeTool, dashed, handleDeleteSelected, pushHistory, setSelection, strokeColor, textOpen, tool],
  );

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const board = boardRef.current;
    if (!board) {
      return;
    }
    const pair = readBoardCoords(event.nativeEvent);
    if (!pair) {
      return;
    }

    const shapeMove = shapeMoveRef.current;
    if (shapeMove && shapeMove.pointerId === event.pointerId) {
      event.preventDefault();
      const [x, y] = pair;
      const dx = x - shapeMove.lastX;
      const dy = y - shapeMove.lastY;
      if (dx || dy) {
        if (shapeMove.text && typeof shapeMove.text.X === "function" && typeof shapeMove.text.Y === "function") {
          moveTextTo(board, shapeMove.text, shapeMove.text.X() + dx, shapeMove.text.Y() + dy);
        } else {
          translatePoints(board, shapeMove.points, dx, dy);
        }
        shapeMove.lastX = x;
        shapeMove.lastY = y;
        shapeMove.moved = true;
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const near = findNearestPoint(board, pair[0], pair[1]);
    if (near && near !== drag.end && typeof near.X === "function" && typeof near.Y === "function") {
      movePointTo(board, drag.end, near.X(), near.Y());
    } else {
      movePointTo(board, drag.end, pair[0], pair[1]);
    }
  }, []);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (pointDragPendingRef.current) {
        pointDragPendingRef.current = false;
        // Point was moved by JSXGraph — snapshot after the gesture.
        window.setTimeout(() => pushHistory(), 0);
      }

      const shapeMove = shapeMoveRef.current;
      if (shapeMove && shapeMove.pointerId === event.pointerId) {
        event.preventDefault();
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // ignore
        }
        if (shapeMove.moved) {
          pushHistory();
        }
        shapeMoveRef.current = null;
        return;
      }

      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      dragRef.current = null;
      completeTool();
    },
    [completeTool, pushHistory],
  );

  const finishPolygon = () => {
    const board = boardRef.current;
    if (!board || pointsRef.current.length < 3) {
      setError("Add at least 3 corners, then tap Finish.");
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
      clearSelection();
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
      clearSelection();
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
          <div className="geo-workspace__header-copy">
            <h2>Geometry</h2>
            <p>Drag shapes to move them. Use Segment to draw radius, diameter, or diagonal like a line in Word.</p>
          </div>
          <div className="geo-workspace__header-actions">
            <button type="button" className="rte-modal__ghost chem-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="rte-modal__primary chem-btn chem-btn--primary"
              onClick={handleSave}
              disabled={busy}
            >
              {busy ? "Saving…" : "Done"}
            </button>
          </div>
        </header>

        <div className="geo-workspace__guide" role="status">
          {guide}
        </div>

        <div className="geo-workspace__categories" role="tablist" aria-label="Tool groups">
          {TOOLBAR_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`geo-cat ${tab === item.id ? "is-active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="geo-workspace__tools" role="toolbar" aria-label="Drawing tools">
          {tabTools.map((item) => (
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

        {tool === "circle" ? (
          <div className="geo-workspace__modes" role="group" aria-label="Circle creation mode">
            <span className="geo-workspace__modes-label">Circle by</span>
            {CIRCLE_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`geo-mode ${circleMode === mode.id ? "is-active" : ""}`}
                title={mode.title}
                onClick={() => {
                  setCircleMode(mode.id);
                  setStep(initialStepFor("circle", mode.id));
                  clearPending();
                  setError("");
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
        ) : null}

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
          {tool === "polygon" || step === "await_polygon_more" ? (
            <button type="button" className="geo-ctrl geo-ctrl--accent" onClick={finishPolygon}>
              ✓ Finish
            </button>
          ) : null}
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

        <div className="geo-workspace__board-wrap">
          <div
            id={boardId}
            ref={boardHostRef}
            className="geo-workspace__board"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          {textOpen && textPixel ? (
            <div
              className="geo-text-inline"
              style={{ left: textPixel.left, top: textPixel.top }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                ref={textInputRef}
                className="geo-text-inline__input"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder="e.g. 5 cm, 60°, AB = 10 cm"
                autoFocus
                aria-label="Text inside figure"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitText();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelText();
                  }
                }}
              />
              <div className="geo-text-inline__actions">
                <button type="button" className="geo-text-inline__done" onClick={commitText}>
                  Done
                </button>
                <button type="button" className="geo-text-inline__cancel" onClick={cancelText}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {tool === "polygon" || step === "await_polygon_more" ? (
            <button type="button" className="geo-fab-finish" onClick={finishPolygon}>
              ✓ Finish polygon
            </button>
          ) : null}
        </div>

        {selectedKind && tool === "select" ? (
          <div className="geo-context" role="toolbar" aria-label={`Actions for ${selectedLabel}`}>
            <span className="geo-context__label">{selectedLabel}</span>
            {renameOpen ? (
              <div className="geo-context__rename">
                <input
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  maxLength={8}
                  aria-label="Point label"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const sel = selectedRef.current;
                      if (sel && isPoint(sel.el) && renameDraft.trim()) {
                        const name = renameDraft.trim().slice(0, 8);
                        sel.el.setName?.(name);
                        usedNamesRef.current.add(name);
                        setSelectedLabel(name);
                        pushHistory();
                      }
                      setRenameOpen(false);
                    }
                    if (e.key === "Escape") {
                      setRenameOpen(false);
                    }
                  }}
                />
                <button
                  type="button"
                  className="geo-context__btn"
                  onClick={() => {
                    const sel = selectedRef.current;
                    if (sel && isPoint(sel.el) && renameDraft.trim()) {
                      const name = renameDraft.trim().slice(0, 8);
                      sel.el.setName?.(name);
                      usedNamesRef.current.add(name);
                      setSelectedLabel(name);
                      pushHistory();
                    }
                    setRenameOpen(false);
                  }}
                >
                  Save
                </button>
                <button type="button" className="geo-context__btn" onClick={() => setRenameOpen(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              ctxActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={`geo-context__btn ${action.id === "delete" ? "is-danger" : ""} ${
                    pendingCtx === action.id ? "is-active" : ""
                  }`}
                  title={action.title}
                  onClick={() => runContextual(action.id)}
                >
                  {action.label}
                </button>
              ))
            )}
          </div>
        ) : null}

        {error ? <p className="rte-modal__error geo-workspace__error">{error}</p> : null}

        <footer className="geo-workspace__footer chem-actions">
          <p className="geo-workspace__footer-hint">Tap Done to insert this figure into the question.</p>
          <button type="button" className="rte-modal__ghost chem-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="rte-modal__primary chem-btn chem-btn--primary"
            onClick={handleSave}
            disabled={busy}
          >
            {busy ? "Saving…" : "Done"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default GeometryWorkspace;
