"use client";

import "@excalidraw/excalidraw/index.css";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";

type SketchFigureModalProps = {
  open: boolean;
  title: string;
  hint: string;
  insertLabel: string;
  allowUpload?: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
};

type ExcalidrawAPI = {
  getSceneElements: () => unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
};

const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
  loading: () => <p className="rte-modal__hint">Loading canvas…</p>,
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
  onClose,
  onInsert,
}: Omit<SketchFigureModalProps, "open">) => {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"draw" | "upload">("draw");

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
    const api = apiRef.current;
    if (!api) {
      setError("Canvas is not ready yet.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const elements = api.getSceneElements() as never[];
      if (!elements.length) {
        throw new Error("Draw something first, or upload an image.");
      }
      const blob = await exportToBlob({
        elements,
        appState: {
          ...api.getAppState(),
          exportWithDarkMode: false,
          exportBackground: true,
        } as never,
        files: api.getFiles() as never,
        mimeType: "image/png",
        quality: 1,
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
              className={`rte-modal__chip ${mode === "draw" ? "is-active" : ""}`}
              onClick={() => setMode("draw")}
            >
              Quick draw
            </button>
            <button
              type="button"
              className={`rte-modal__chip ${mode === "upload" ? "is-active" : ""}`}
              onClick={() => setMode("upload")}
            >
              Upload image
            </button>
          </div>
        ) : null}

        {error ? <p className="rte-modal__error">{error}</p> : null}

        <div className="rte-inline-panel__body">
          {mode === "draw" ? (
            <div className="rte-excalidraw-host">
              <Excalidraw
                excalidrawAPI={(api) => {
                  apiRef.current = api as unknown as ExcalidrawAPI;
                }}
                theme="light"
              />
            </div>
          ) : (
            <div className="rte-upload-panel">
              <p className="rte-modal__hint">
                Upload a photo or screenshot of your figure. This is often the fastest option for textbooks and worksheets.
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
