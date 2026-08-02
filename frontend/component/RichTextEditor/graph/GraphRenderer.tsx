"use client";

import { useEffect, useRef } from "react";
import type { GraphDefinition } from "@/utils/exam/graph/graphTypes";

type GraphRendererProps = {
  definition: GraphDefinition;
  interactive?: boolean;
  className?: string;
};

const COLORS = ["#49734f", "#2f6fed", "#d24b44", "#c49a3c", "#6b5b95", "#1a8a8a"];

const renderCanvas3d = (canvas: HTMLCanvasElement, definition: GraphDefinition) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const project = (x: number, y: number, z: number) => {
    const scale = 70;
    const px = width / 2 + (x - y) * scale * 0.75;
    const py = height / 2 + (x + y) * scale * 0.38 - z * scale;
    return { px, py };
  };

  ctx.strokeStyle = "#49734f";
  ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i += 1) {
    for (let j = -8; j < 8; j += 1) {
      const x1 = i / 4;
      const y1 = j / 4;
      const x2 = i / 4;
      const y2 = (j + 1) / 4;
      const z1 = Math.sin(Math.sqrt(x1 * x1 + y1 * y1));
      const z2 = Math.sin(Math.sqrt(x2 * x2 + y2 * y2));
      const a = project(x1, y1, z1);
      const b = project(x2, y2, z2);
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
    }
  }

  if (definition.title) {
    ctx.fillStyle = "#232a25";
    ctx.font = "14px sans-serif";
    ctx.fillText(definition.title, 12, 22);
  }
};

const GraphRenderer = ({ definition, interactive = false, className = "" }: GraphRendererProps) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    host.innerHTML = "";

    const width = definition.width ?? 480;
    const height = definition.height ?? 320;

    const run = async () => {
      if (definition.kind === "function" || definition.kind === "coordinate") {
        const functionPlot = (await import("function-plot")).default;
        if (cancelled || !hostRef.current) {
          return;
        }
        const data =
          definition.kind === "coordinate"
            ? [
                { fn: definition.expressionB || "0", color: "#999999" },
                { fn: definition.expression || "x", color: COLORS[0] },
              ]
            : [{ fn: definition.expression || "x", color: COLORS[0] }];

        functionPlot({
          target: hostRef.current,
          width,
          height,
          grid: true,
          xAxis: {
            label: definition.xLabel || "x",
            domain: [definition.xMin ?? -10, definition.xMax ?? 10],
          },
          yAxis: {
            label: definition.yLabel || "y",
            domain: [definition.yMin ?? -10, definition.yMax ?? 10],
          },
          data,
          disableZoom: !interactive,
        });
        return;
      }

      if (definition.kind === "surface3d") {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        host.appendChild(canvas);
        renderCanvas3d(canvas, definition);
        return;
      }

      const Recharts = await import("recharts");
      if (cancelled || !hostRef.current) {
        return;
      }

      const {
        ResponsiveContainer,
        BarChart,
        Bar,
        LineChart,
        Line,
        AreaChart,
        Area,
        PieChart,
        Pie,
        Cell,
        ScatterChart,
        Scatter,
        XAxis,
        YAxis,
        CartesianGrid,
        Tooltip,
        Legend,
      } = Recharts;

      const { createRoot } = await import("react-dom/client");
      const React = await import("react");
      const mount = document.createElement("div");
      mount.style.width = "100%";
      mount.style.height = `${height}px`;
      host.appendChild(mount);
      const root = createRoot(mount);
      // Bypass strict createElement overloads for dynamic Recharts trees.
      const h = React.createElement as unknown as (
        type: unknown,
        props: Record<string, unknown> | null,
        ...children: unknown[]
      ) => React.ReactElement;

      const categories = definition.categories ?? [];
      const values = definition.values ?? [];
      const series = definition.series ?? [];

      if (definition.kind === "pie" || definition.kind === "donut") {
        const data = categories.map((name, index) => ({
          name,
          value: values[index] ?? 0,
        }));
        root.render(
          h(
            ResponsiveContainer,
            { width: "100%", height },
            h(
              PieChart,
              null,
              h(
                Pie,
                {
                  data,
                  dataKey: "value",
                  nameKey: "name",
                  cx: "50%",
                  cy: "50%",
                  innerRadius: definition.kind === "donut" ? 55 : 0,
                  outerRadius: 100,
                  label: true,
                },
                data.map((_, index) => h(Cell, { key: index, fill: COLORS[index % COLORS.length] })),
              ),
              h(Tooltip, null),
              h(Legend, null),
            ),
          ),
        );
        return () => {
          root.unmount();
        };
      }

      if (definition.kind === "scatter") {
        const data = (definition.points ?? []).map((point) => ({ x: Number(point.x), y: point.y }));
        root.render(
          h(
            ResponsiveContainer,
            { width: "100%", height },
            h(
              ScatterChart,
              null,
              h(CartesianGrid, { strokeDasharray: "3 3" }),
              h(XAxis, { type: "number", dataKey: "x", name: definition.xLabel || "x" }),
              h(YAxis, { type: "number", dataKey: "y", name: definition.yLabel || "y" }),
              h(Tooltip, { cursor: { strokeDasharray: "3 3" } }),
              h(Scatter, { data, fill: COLORS[0] }),
            ),
          ),
        );
        return () => {
          root.unmount();
        };
      }

      if (definition.kind === "histogram") {
        const bins = definition.bins || 5;
        const sample = values.length ? values : [1, 2, 2, 3, 3, 3, 4, 5, 5];
        const min = Math.min(...sample);
        const max = Math.max(...sample);
        const step = (max - min || 1) / bins;
        const hist = Array.from({ length: bins }, (_, index) => {
          const start = min + index * step;
          const end = start + step;
          const count = sample.filter((value) => value >= start && (index === bins - 1 ? value <= end : value < end)).length;
          return { name: `${start.toFixed(1)}-${end.toFixed(1)}`, value: count };
        });
        root.render(
          h(
            ResponsiveContainer,
            { width: "100%", height },
            h(
              BarChart,
              { data: hist },
              h(CartesianGrid, { strokeDasharray: "3 3" }),
              h(XAxis, { dataKey: "name" }),
              h(YAxis, null),
              h(Tooltip, null),
              h(Bar, { dataKey: "value", fill: COLORS[0] }),
            ),
          ),
        );
        return () => {
          root.unmount();
        };
      }

      if (definition.kind === "grouped-bar" || definition.kind === "stacked-bar") {
        const data = categories.map((name, index) => {
          const row: Record<string, string | number> = { name };
          series.forEach((item) => {
            row[item.name] = item.values[index] ?? 0;
          });
          return row;
        });
        root.render(
          h(
            ResponsiveContainer,
            { width: "100%", height },
            h(
              BarChart,
              { data },
              h(CartesianGrid, { strokeDasharray: "3 3" }),
              h(XAxis, { dataKey: "name" }),
              h(YAxis, null),
              h(Tooltip, null),
              h(Legend, null),
              ...series.map((item, index) =>
                h(Bar, {
                  key: item.name,
                  dataKey: item.name,
                  stackId: definition.kind === "stacked-bar" ? "stack" : undefined,
                  fill: COLORS[index % COLORS.length],
                }),
              ),
            ),
          ),
        );
        return () => {
          root.unmount();
        };
      }

      const data = categories.map((name, index) => ({
        name,
        value: values[index] ?? 0,
      }));

      if (definition.kind === "line") {
        root.render(
          h(
            ResponsiveContainer,
            { width: "100%", height },
            h(
              LineChart,
              { data },
              h(CartesianGrid, { strokeDasharray: "3 3" }),
              h(XAxis, { dataKey: "name" }),
              h(YAxis, null),
              h(Tooltip, null),
              h(Line, { type: "monotone", dataKey: "value", stroke: COLORS[0], strokeWidth: 2 }),
            ),
          ),
        );
        return () => {
          root.unmount();
        };
      }

      if (definition.kind === "area") {
        root.render(
          h(
            ResponsiveContainer,
            { width: "100%", height },
            h(
              AreaChart,
              { data },
              h(CartesianGrid, { strokeDasharray: "3 3" }),
              h(XAxis, { dataKey: "name" }),
              h(YAxis, null),
              h(Tooltip, null),
              h(Area, { type: "monotone", dataKey: "value", stroke: COLORS[0], fill: "#c5d7c8" }),
            ),
          ),
        );
        return () => {
          root.unmount();
        };
      }

      root.render(
        h(
          ResponsiveContainer,
          { width: "100%", height },
          h(
            BarChart,
            { data },
            h(CartesianGrid, { strokeDasharray: "3 3" }),
            h(XAxis, { dataKey: "name" }),
            h(YAxis, null),
            h(Tooltip, null),
            h(Bar, { dataKey: "value", fill: COLORS[0] }),
          ),
        ),
      );
      return () => {
        root.unmount();
      };
    };

    let cleanup: void | (() => void);
    void run().then((result) => {
      cleanup = result;
    });

    return () => {
      cancelled = true;
      if (typeof cleanup === "function") {
        cleanup();
      }
      if (host) {
        host.innerHTML = "";
      }
    };
  }, [definition, interactive]);

  return <div ref={hostRef} className={`rte-graph-render ${className}`.trim()} data-graph-kind={definition.kind} />;
};

export default GraphRenderer;
