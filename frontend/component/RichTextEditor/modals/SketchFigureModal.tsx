"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "tldraw";
import "tldraw/tldraw.css";

type SketchFigureModalProps = {
  open: boolean;
  title: string;
  hint: string;
  insertLabel: string;
  allowUpload?: boolean;
  defaultMode?: "draw" | "upload";
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

const SketchFigureModalBody = ({
  title,
  hint,
  insertLabel,
  allowUpload = false,
  defaultMode = "draw",
  onClose,
  onInsert,
}: Omit<SketchFigureModalProps, "open">) => {
  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"draw" | "upload">(allowUpload ? defaultMode : "draw");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
        throw new Error("Draw something first, or switch to Upload image.");
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

        {allowUpload ? (
          <div className="rte-modal__chips" role="tablist" aria-label="Insert method">
            <button
              type="button"
              className={`rte-modal__chip ${mode === "upload" ? "is-active" : ""}`}
              onClick={() => setMode("upload")}
            >
              Upload image
            </button>
            <button
              type="button"
              className={`rte-modal__chip ${mode === "draw" ? "is-active" : ""}`}
              onClick={() => setMode("draw")}
            >
              Draw
            </button>
          </div>
        ) : null}

        {error ? <p className="rte-modal__error">{error}</p> : null}

        <div className="rte-inline-panel__body">
          {mode === "draw" ? (
            <div className="rte-tldraw-host">
              <Tldraw
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
              />
            </div>
          ) : (
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
          )}
        </div>

        <div className="rte-modal__actions rte-modal__actions--sticky">
          <button type="button" className="rte-modal__ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {mode === "draw" ? (
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

  return createPortal(<SketchFigureModalBody key={`${rest.title}-session`} {...rest} />, document.body);
};

export default SketchFigureModal;
