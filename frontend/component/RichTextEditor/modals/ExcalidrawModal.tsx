"use client";

import "@excalidraw/excalidraw/index.css";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

type ExcalidrawModalProps = {
  open: boolean;
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
  loading: () => <p className="rte-modal__hint">Loading drawing canvas…</p>,
});

const ExcalidrawModalBody = ({ onClose, onInsert }: Omit<ExcalidrawModalProps, "open">) => {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleInsert = useCallback(async () => {
    const api = apiRef.current;
    if (!api) {
      setError("Drawing canvas is not ready yet.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements: api.getSceneElements() as never,
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
        reader.onerror = () => reject(new Error("Failed to read drawing"));
        reader.readAsDataURL(blob);
      });
      onInsert(dataUrl);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export drawing");
    } finally {
      setBusy(false);
    }
  }, [onInsert]);

  return (
    <div className="rte-editor-overlay" role="dialog" aria-modal="true" aria-label="Insert drawing">
      <div className="rte-inline-panel rte-inline-panel--tool">
        <div className="rte-inline-panel__header">
          <h3>Insert drawing</h3>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="rte-modal__hint">
          Draw lines, arrows, shapes, and flowcharts. Insert the diagram into your question when ready.
        </p>
        <div className="rte-excalidraw-host">
          <Excalidraw
            excalidrawAPI={(api) => {
              apiRef.current = api as unknown as ExcalidrawAPI;
            }}
            theme="light"
          />
        </div>
        {error ? <p className="rte-modal__error">{error}</p> : null}
        <div className="rte-modal__actions">
          <button type="button" className="rte-modal__secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="rte-modal__primary" onClick={() => void handleInsert()} disabled={busy}>
            {busy ? "Exporting…" : "Insert drawing"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ExcalidrawModal = ({ open, onClose, onInsert }: ExcalidrawModalProps) => {
  if (!open) {
    return null;
  }

  return <ExcalidrawModalBody key="excalidraw-session" onClose={onClose} onInsert={onInsert} />;
};

export default ExcalidrawModal;
