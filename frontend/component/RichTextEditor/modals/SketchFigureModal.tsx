"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "tldraw";
import "tldraw/tldraw.css";
import {
  applyCadLiteDefaults,
  applyChemistryDefaults,
  CHEMISTRY_GROUPS,
  GEOMETRY_GROUPS,
  type FigurePaletteItem,
} from "./figurePalettes";

type FigureMode = "geometry" | "chemistry";

type SketchFigureModalProps = {
  open: boolean;
  mode: FigureMode;
  title: string;
  hint: string;
  insertLabel: string;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
};

const Tldraw = dynamic(async () => (await import("tldraw")).Tldraw, {
  ssr: false,
  loading: () => <p className="rte-modal__hint">Loading drawing tools…</p>,
});

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

const refreshViewport = (editor: Editor, host: HTMLElement | null) => {
  if (!host) {
    return;
  }
  editor.updateViewportScreenBounds(host, true);
};

const SketchFigureModalBody = ({
  mode,
  title,
  hint,
  insertLabel,
  onClose,
  onInsert,
}: Omit<SketchFigureModalProps, "open">) => {
  const editorRef = useRef<Editor | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"draw" | "upload">("draw");
  const [activeStamp, setActiveStamp] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  const groups = mode === "geometry" ? GEOMETRY_GROUPS : CHEMISTRY_GROUPS;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const host = hostRef.current;
    const editor = editorRef.current;
    if (!host || !editor || !editorReady) {
      return;
    }

    const sync = () => refreshViewport(editor, host);
    sync();
    const observer = new ResizeObserver(() => sync());
    observer.observe(host);

    return () => {
      observer.disconnect();
    };
  }, [editorReady, view]);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      if (mode === "geometry") {
        applyCadLiteDefaults(editor);
      } else {
        applyChemistryDefaults(editor);
      }
      setEditorReady(true);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => refreshViewport(editor, hostRef.current));
      });
    },
    [mode],
  );

  const handlePaletteClick = (item: FigurePaletteItem) => {
    const editor = editorRef.current;
    if (!editor) {
      setError("Canvas is not ready yet.");
      return;
    }
    setError("");
    setActiveStamp(item.id);
    setView("draw");
    item.run(editor);
  };

  const handleInsertDrawing = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) {
      setError("Canvas is not ready yet.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const shapeIds = [...editor.getCurrentPageShapeIds()];
      if (!shapeIds.length) {
        throw new Error("Draw or stamp something first, or switch to Upload image.");
      }

      const { blob } = await editor.toImage(shapeIds, {
        format: "png",
        background: true,
        padding: 16,
        scale: 2,
      });

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Failed to export drawing"));
        reader.readAsDataURL(blob);
      });
      onInsert(dataUrl);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export drawing");
    } finally {
      setBusy(false);
    }
  }, [onInsert]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, SVG, etc.).");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onInsert(dataUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rte-editor-overlay rte-editor-overlay--fixed"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="rte-inline-panel rte-inline-panel--tool rte-inline-panel--fixed">
        <div className="rte-inline-panel__header">
          <h3>{title}</h3>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="rte-modal__hint">{hint}</p>

        <div className="rte-modal__chips" role="tablist" aria-label="Insert method">
          <button
            type="button"
            className={`rte-modal__chip ${view === "draw" ? "is-active" : ""}`}
            onClick={() => setView("draw")}
          >
            Draw
          </button>
          <button
            type="button"
            className={`rte-modal__chip ${view === "upload" ? "is-active" : ""}`}
            onClick={() => setView("upload")}
          >
            Upload image
          </button>
        </div>

        {view === "draw" ? (
          <div className="rte-figure-palette" aria-label={`${mode} tools`}>
            {groups.map((group) => (
              <div key={group.id} className="rte-figure-palette__group">
                <span className="rte-figure-palette__group-label">{group.label}</span>
                <div className="rte-figure-palette__row" role="toolbar" aria-label={group.label}>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      title={item.title}
                      className={`rte-figure-palette__btn ${activeStamp === item.id ? "is-active" : ""}`}
                      onClick={() => handlePaletteClick(item)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <p className="rte-modal__error">{error}</p> : null}

        <div className="rte-inline-panel__body">
          <div
            ref={hostRef}
            className={`rte-tldraw-host ${view === "draw" ? "" : "is-hidden"}`.trim()}
            aria-hidden={view !== "draw"}
          >
            <Tldraw onMount={handleMount} />
          </div>
          {view === "upload" ? (
            <div className="rte-upload-panel">
              <p className="rte-modal__hint">
                Fastest option: upload a photo or screenshot of the figure from a textbook or worksheet.
              </p>
              <button
                type="button"
                className="rte-modal__primary"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {busy ? "Uploading…" : "Choose image"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleUpload(event)}
              />
            </div>
          ) : null}
        </div>

        <div className="rte-modal__actions rte-modal__actions--sticky">
          <button type="button" className="rte-modal__ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {view === "draw" ? (
            <button
              type="button"
              className="rte-modal__primary"
              onClick={() => void handleInsertDrawing()}
              disabled={busy}
            >
              {busy ? "Inserting…" : insertLabel}
            </button>
          ) : (
            <button
              type="button"
              className="rte-modal__primary"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? "Uploading…" : "Upload & insert"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const SketchFigureModal = ({ open, ...rest }: SketchFigureModalProps) => {
  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(<SketchFigureModalBody key={`${rest.mode}-session`} {...rest} />, document.body);
};

export default SketchFigureModal;
