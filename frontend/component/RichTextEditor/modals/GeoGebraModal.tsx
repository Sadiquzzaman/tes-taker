"use client";

import { useEffect, useRef, useState } from "react";

type GeoGebraModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
};

type GgbApi = {
  getPNGBase64: (scale?: number, transparent?: boolean) => string;
};

type GgbAppletCtor = new (
  params: Record<string, string | number | boolean>,
  views?: Record<string, unknown>,
) => {
  inject: (id: string) => void;
};

const GEOGEBRA_SCRIPT = "https://www.geogebra.org/apps/deployggb.js";

const loadGeoGebraScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("GeoGebra requires a browser"));
      return;
    }

    if ((window as Window & { GGBApplet?: GgbAppletCtor }).GGBApplet) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GEOGEBRA_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load GeoGebra")));
      return;
    }

    const script = document.createElement("script");
    script.src = GEOGEBRA_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load GeoGebra"));
    document.body.appendChild(script);
  });

const GeoGebraModalBody = ({ onClose, onInsert }: Omit<GeoGebraModalProps, "open">) => {
  const [containerId] = useState(() => `ggb-${Date.now().toString(36)}`);
  const apiRef = useRef<GgbApi | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        await loadGeoGebraScript();
        if (cancelled) {
          return;
        }

        const GGBApplet = (window as Window & { GGBApplet?: GgbAppletCtor }).GGBApplet;
        if (!GGBApplet) {
          throw new Error("GeoGebra applet unavailable");
        }

        const applet = new GGBApplet(
          {
            appName: "geometry",
            width: 640,
            height: 420,
            showToolBar: true,
            showAlgebraInput: true,
            showMenuBar: false,
            enableRightClick: true,
            enableShiftDragZoom: true,
            language: "en",
          },
          {
            appletOnLoad: (api: GgbApi) => {
              if (cancelled) {
                return;
              }
              apiRef.current = api;
              setReady(true);
            },
          },
        );

        const host = document.getElementById(containerId);
        if (host) {
          host.innerHTML = "";
        }
        applet.inject(containerId);
      } catch (bootError) {
        if (!cancelled) {
          setError(bootError instanceof Error ? bootError.message : "Unable to start GeoGebra");
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
      apiRef.current = null;
      const host = document.getElementById(containerId);
      if (host) {
        host.innerHTML = "";
      }
    };
  }, [containerId]);

  const handleInsert = () => {
    const api = apiRef.current;
    if (!api) {
      return;
    }

    setSaving(true);
    try {
      const png = api.getPNGBase64(2, false);
      if (!png) {
        throw new Error("Nothing to export yet. Draw a figure first.");
      }
      const dataUrl = png.startsWith("data:") ? png : `data:image/png;base64,${png}`;
      onInsert(dataUrl);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Export failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rte-editor-overlay" role="dialog" aria-modal="true" aria-label="Insert geometry figure">
      <div className="rte-inline-panel rte-inline-panel--tool">
        <div className="rte-inline-panel__header">
          <h3>Insert geometry figure</h3>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="rte-modal__hint">Build a figure, then insert it into the question without leaving the editor.</p>
        {error ? <p className="rte-modal__error">{error}</p> : null}
        <div id={containerId} className="rte-geogebra-host" />
        <div className="rte-modal__actions">
          <button type="button" className="rte-modal__ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="rte-modal__primary" onClick={handleInsert} disabled={!ready || saving}>
            {saving ? "Inserting…" : "Insert figure"}
          </button>
        </div>
      </div>
    </div>
  );
};

const GeoGebraModal = ({ open, onClose, onInsert }: GeoGebraModalProps) => {
  if (!open) {
    return null;
  }

  return <GeoGebraModalBody key="geogebra-session" onClose={onClose} onInsert={onInsert} />;
};

export default GeoGebraModal;
