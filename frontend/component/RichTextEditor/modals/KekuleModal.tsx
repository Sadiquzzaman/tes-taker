"use client";

import { useEffect, useRef, useState } from "react";

type KekuleModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
};

type KekuleNamespace = {
  Editor?: {
    Composer: new (parent: HTMLElement) => {
      getChemObj?: () => unknown;
      setDimension?: (w: string | number, h: string | number) => void;
      finalize?: () => void;
    };
  };
  Render?: {
    ChemObj2DPainter?: new (
      engine: string,
      parent: HTMLElement,
    ) => {
      setChemObj?: (obj: unknown) => void;
      draw?: () => void;
    };
  };
  IO?: {
    saveMimeData?: (obj: unknown, mime: string) => string;
  };
};

const KekuleModalBody = ({ onClose, onInsert }: Omit<KekuleModalProps, "open">) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<{ getChemObj?: () => unknown; finalize?: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;

    const boot = async () => {
      try {
        await import("kekule/theme");
        const mod = (await import("kekule")) as { Kekule?: KekuleNamespace; default?: KekuleNamespace };
        const Kekule = (mod.Kekule || mod.default || mod) as KekuleNamespace;

        if (cancelled || !host) {
          return;
        }

        host.innerHTML = "";
        if (!Kekule.Editor?.Composer) {
          throw new Error("Kekule Composer unavailable");
        }

        const composer = new Kekule.Editor.Composer(host);
        composer.setDimension?.("100%", 420);
        composerRef.current = composer;
        setReady(true);
      } catch (bootError) {
        if (!cancelled) {
          setError(bootError instanceof Error ? bootError.message : "Unable to start chemistry editor");
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
      try {
        composerRef.current?.finalize?.();
      } catch {
        // ignore cleanup errors
      }
      composerRef.current = null;
      if (host) {
        host.innerHTML = "";
      }
    };
  }, []);

  const handleInsert = async () => {
    const composer = composerRef.current;
    if (!composer?.getChemObj) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const chemObj = composer.getChemObj();
      if (!chemObj) {
        throw new Error("Draw a structure or reaction first.");
      }

      const mod = (await import("kekule")) as { Kekule?: KekuleNamespace; default?: KekuleNamespace };
      const Kekule = (mod.Kekule || mod.default || mod) as KekuleNamespace;

      let dataUrl = "";
      if (Kekule.IO?.saveMimeData) {
        try {
          const svg = Kekule.IO.saveMimeData(chemObj, "image/svg+xml");
          if (svg) {
            dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
          }
        } catch {
          // fall through to canvas export
        }
      }

      if (!dataUrl) {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 360;
        const paintHost = document.createElement("div");
        paintHost.style.position = "fixed";
        paintHost.style.left = "-9999px";
        paintHost.appendChild(canvas);
        document.body.appendChild(paintHost);

        if (Kekule.Render?.ChemObj2DPainter) {
          const painter = new Kekule.Render.ChemObj2DPainter("canvas", canvas);
          painter.setChemObj?.(chemObj);
          painter.draw?.();
          dataUrl = canvas.toDataURL("image/png");
        }

        document.body.removeChild(paintHost);
      }

      if (!dataUrl) {
        throw new Error("Could not export the chemistry drawing.");
      }

      onInsert(dataUrl);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Export failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rte-editor-overlay" role="dialog" aria-modal="true" aria-label="Insert chemistry figure">
      <div className="rte-inline-panel rte-inline-panel--tool">
        <div className="rte-inline-panel__header">
          <h3>Insert chemistry figure</h3>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="rte-modal__hint">
          Draw a structure or reaction, then insert it into the question without leaving the editor.
        </p>
        {error ? <p className="rte-modal__error">{error}</p> : null}
        <div ref={hostRef} className="rte-kekule-host" />
        <div className="rte-modal__actions">
          <button type="button" className="rte-modal__ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rte-modal__primary"
            onClick={() => void handleInsert()}
            disabled={!ready || saving}
          >
            {saving ? "Inserting…" : "Insert structure"}
          </button>
        </div>
      </div>
    </div>
  );
};

const KekuleModal = ({ open, onClose, onInsert }: KekuleModalProps) => {
  if (!open) {
    return null;
  }

  return <KekuleModalBody key="kekule-session" onClose={onClose} onInsert={onInsert} />;
};

export default KekuleModal;
