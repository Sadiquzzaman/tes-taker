"use client";

import { useEffect, useRef, useState } from "react";

type GraphModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
};

type GraphKind = "function" | "coordinate" | "statistics" | "3d";

const drawStatisticsBars = (canvas: HTMLCanvasElement, values: number[]) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const max = Math.max(...values, 1);
  const padding = 40;
  const barGap = 12;
  const usableWidth = width - padding * 2;
  const barWidth = Math.max(12, (usableWidth - barGap * (values.length - 1)) / values.length);

  ctx.strokeStyle = "#d6d7d4";
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.stroke();

  values.forEach((value, index) => {
    const barHeight = ((height - padding * 2) * value) / max;
    const x = padding + index * (barWidth + barGap);
    const y = height - padding - barHeight;
    ctx.fillStyle = "#49734f";
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#232a25";
    ctx.font = "12px sans-serif";
    ctx.fillText(String(value), x, y - 6);
  });
};

const drawBasic3d = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const project = (x: number, y: number, z: number) => {
    const scale = 90;
    const px = width / 2 + (x - y) * scale * 0.7;
    const py = height / 2 + (x + y) * scale * 0.35 - z * scale;
    return { px, py };
  };

  ctx.strokeStyle = "#49734f";
  ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i += 1) {
    for (let j = -8; j < 8; j += 1) {
      const z1 = Math.sin(Math.sqrt(i * i + j * j) / 2.5);
      const z2 = Math.sin(Math.sqrt(i * i + (j + 1) * (j + 1)) / 2.5);
      const a = project(i / 4, j / 4, z1);
      const b = project(i / 4, (j + 1) / 4, z2);
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
    }
  }
};

const GraphModalBody = ({ onClose, onInsert }: Omit<GraphModalProps, "open">) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<GraphKind>("function");
  const [expression, setExpression] = useState("sin(x)");
  const [statsValues, setStatsValues] = useState("12, 19, 8, 15, 22, 10");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    host.innerHTML = "";

    const render = async () => {
      setError("");
      try {
        if (kind === "function" || kind === "coordinate") {
          const functionPlot = (await import("function-plot")).default;
          if (cancelled || !hostRef.current) {
            return;
          }
          hostRef.current.innerHTML = "";
          functionPlot({
            target: hostRef.current,
            width: Math.min(640, hostRef.current.clientWidth || 640),
            height: 360,
            grid: true,
            xAxis: { label: "x" },
            yAxis: { label: "y" },
            data:
              kind === "coordinate"
                ? [
                    { fn: "0", color: "#999" },
                    { fn: "x", color: "#49734f" },
                  ]
                : [{ fn: expression || "x", color: "#49734f" }],
          });
          return;
        }

        if (cancelled || !hostRef.current) {
          return;
        }
        hostRef.current.innerHTML = "";
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 360;
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        hostRef.current.appendChild(canvas);

        if (kind === "statistics") {
          const values = statsValues
            .split(/[,;\s]+/)
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value));
          drawStatisticsBars(canvas, values.length ? values : [0]);
          return;
        }

        drawBasic3d(canvas);
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : "Unable to render graph");
        }
      }
    };

    void render();
    return () => {
      cancelled = true;
      if (host) {
        host.innerHTML = "";
      }
    };
  }, [expression, kind, statsValues]);

  const handleInsert = async () => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(host, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      onInsert(canvas.toDataURL("image/png"));
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Unable to capture graph");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rte-modal-backdrop" role="dialog" aria-modal="true" aria-label="Graph editor">
      <div className="rte-modal rte-modal--wide">
        <div className="rte-modal__header">
          <h3>Graph</h3>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="rte-modal__row rte-graph-tabs">
          {(
            [
              ["function", "Function"],
              ["coordinate", "Coordinate"],
              ["statistics", "Statistics"],
              ["3d", "3D"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`rte-modal__chip ${kind === value ? "is-active" : ""}`}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {kind === "function" ? (
          <label className="rte-modal__field">
            <span>f(x) =</span>
            <input value={expression} onChange={(event) => setExpression(event.target.value)} />
          </label>
        ) : null}
        {kind === "statistics" ? (
          <label className="rte-modal__field">
            <span>Values (comma-separated)</span>
            <input value={statsValues} onChange={(event) => setStatsValues(event.target.value)} />
          </label>
        ) : null}
        <div ref={hostRef} className="rte-graph-host" />
        {error ? <p className="rte-modal__error">{error}</p> : null}
        <div className="rte-modal__actions">
          <button type="button" className="rte-modal__secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="rte-modal__primary" onClick={() => void handleInsert()} disabled={busy}>
            {busy ? "Capturing…" : "Insert graph"}
          </button>
        </div>
      </div>
    </div>
  );
};

const GraphModal = ({ open, onClose, onInsert }: GraphModalProps) => {
  if (!open) {
    return null;
  }
  return <GraphModalBody key="graph-session" onClose={onClose} onInsert={onInsert} />;
};

export default GraphModal;
