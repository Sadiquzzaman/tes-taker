/**
 * Editable graph definitions stored inside TipTap / exam HTML.
 * New chart kinds can be registered without changing the TipTap node shape.
 */

import { normalizeIndicDigits, parseLocaleNumber } from "./normalizeIndicDigits";

export type GraphKind =
  | "function"
  | "coordinate"
  | "line"
  | "bar"
  | "grouped-bar"
  | "stacked-bar"
  | "pie"
  | "donut"
  | "scatter"
  | "histogram"
  | "area"
  | "surface3d";

export type GraphSeriesPoint = {
  x: string | number;
  y: number;
  z?: number;
};

export type GraphDefinition = {
  version: 1;
  kind: GraphKind;
  title?: string;
  /** function-plot expression, e.g. sin(x) */
  expression?: string;
  /** optional second expression for coordinate overlays */
  expressionB?: string;
  xLabel?: string;
  yLabel?: string;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  /** categorical / numeric series for stats charts */
  categories?: string[];
  values?: number[];
  series?: Array<{ name: string; values: number[] }>;
  points?: GraphSeriesPoint[];
  /** histogram bin count hint */
  bins?: number;
  width?: number;
  height?: number;
};

export type ChartRecommendation = {
  kind: GraphKind;
  label: string;
  reason: string;
};

const KIND_LABELS: Record<GraphKind, string> = {
  function: "Function graph",
  coordinate: "Coordinate geometry",
  line: "Line chart",
  bar: "Bar chart",
  "grouped-bar": "Grouped bar",
  "stacked-bar": "Stacked bar",
  pie: "Pie chart",
  donut: "Donut chart",
  scatter: "Scatter plot",
  histogram: "Histogram",
  area: "Area chart",
  surface3d: "3D surface",
};

export const listGraphKinds = (): Array<{ kind: GraphKind; label: string }> =>
  (Object.keys(KIND_LABELS) as GraphKind[]).map((kind) => ({
    kind,
    label: KIND_LABELS[kind],
  }));

export const getGraphKindLabel = (kind: GraphKind): string => KIND_LABELS[kind] ?? kind;

export const createDefaultGraphDefinition = (kind: GraphKind = "function"): GraphDefinition => {
  switch (kind) {
    case "coordinate":
      return {
        version: 1,
        kind,
        title: "Coordinate plane",
        expression: "x",
        expressionB: "0",
        xMin: -10,
        xMax: 10,
        yMin: -10,
        yMax: 10,
        xLabel: "x",
        yLabel: "y",
        width: 480,
        height: 320,
      };
    case "function":
      return {
        version: 1,
        kind,
        title: "Function",
        expression: "sin(x)",
        xMin: -6.5,
        xMax: 6.5,
        yMin: -2,
        yMax: 2,
        xLabel: "x",
        yLabel: "y",
        width: 480,
        height: 320,
      };
    case "line":
    case "area":
      return {
        version: 1,
        kind,
        title: kind === "area" ? "Area chart" : "Line chart",
        categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        values: [12, 19, 8, 15, 22, 10],
        width: 480,
        height: 320,
      };
    case "bar":
    case "histogram":
      return {
        version: 1,
        kind,
        title: kind === "histogram" ? "Histogram" : "Bar chart",
        categories: ["A", "B", "C", "D", "E"],
        values: [12, 19, 8, 15, 22],
        bins: 5,
        width: 480,
        height: 320,
      };
    case "grouped-bar":
    case "stacked-bar":
      return {
        version: 1,
        kind,
        title: kind === "stacked-bar" ? "Stacked bar" : "Grouped bar",
        categories: ["Q1", "Q2", "Q3", "Q4"],
        series: [
          { name: "Series A", values: [12, 15, 9, 18] },
          { name: "Series B", values: [8, 11, 14, 10] },
        ],
        width: 480,
        height: 320,
      };
    case "pie":
    case "donut":
      return {
        version: 1,
        kind,
        title: kind === "donut" ? "Donut chart" : "Pie chart",
        categories: ["Red", "Blue", "Green", "Yellow"],
        values: [30, 25, 25, 20],
        width: 420,
        height: 320,
      };
    case "scatter":
      return {
        version: 1,
        kind,
        title: "Scatter plot",
        points: [
          { x: 1, y: 2 },
          { x: 2, y: 3.5 },
          { x: 3, y: 2.8 },
          { x: 4, y: 5 },
          { x: 5, y: 4.2 },
          { x: 6, y: 6 },
        ],
        width: 480,
        height: 320,
      };
    case "surface3d":
      return {
        version: 1,
        kind,
        title: "3D surface",
        expression: "sin(sqrt(x*x+y*y))",
        width: 480,
        height: 320,
      };
    default:
      return createDefaultGraphDefinition("function");
  }
};

export const parseGraphDefinition = (raw: unknown): GraphDefinition | null => {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!value || typeof value !== "object") {
      return null;
    }
    const def = value as GraphDefinition;
    if (def.version !== 1 || !def.kind) {
      return null;
    }
    return {
      ...createDefaultGraphDefinition(def.kind),
      ...def,
      version: 1,
    };
  } catch {
    return null;
  }
};

export const serializeGraphDefinition = (definition: GraphDefinition): string =>
  JSON.stringify({ ...definition, version: 1 });

/**
 * Rule-based chart recommendation from a pasted/typed dataset.
 * No AI — shape heuristics only.
 */
export const recommendChartKinds = (input: {
  categories?: string[];
  values?: number[];
  points?: GraphSeriesPoint[];
  looksLikeTime?: boolean;
  partsOfWhole?: boolean;
}): ChartRecommendation[] => {
  const recommendations: ChartRecommendation[] = [];
  const categories = input.categories ?? [];
  const values = input.values ?? [];
  const points = input.points ?? [];

  if (input.partsOfWhole || (categories.length >= 2 && values.length === categories.length && values.every((v) => v >= 0))) {
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum > 0 && values.every((v) => v / sum <= 1)) {
      recommendations.push({
        kind: "pie",
        label: KIND_LABELS.pie,
        reason: "Values look like parts of a whole.",
      });
      recommendations.push({
        kind: "donut",
        label: KIND_LABELS.donut,
        reason: "Alternative parts-of-whole view.",
      });
    }
  }

  if (input.looksLikeTime || categories.some((c) => /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}|q[1-4]/i.test(c))) {
    recommendations.push({
      kind: "line",
      label: KIND_LABELS.line,
      reason: "Categories look like a time series.",
    });
    recommendations.push({
      kind: "area",
      label: KIND_LABELS.area,
      reason: "Time series with magnitude emphasis.",
    });
  }

  if (categories.length >= 2 && values.length === categories.length) {
    recommendations.push({
      kind: "bar",
      label: KIND_LABELS.bar,
      reason: "Categorical values map cleanly to bars.",
    });
  }

  if (points.length >= 3) {
    recommendations.push({
      kind: "scatter",
      label: KIND_LABELS.scatter,
      reason: "Numeric (x, y) pairs detected.",
    });
  }

  if (values.length >= 5 && categories.length === 0) {
    recommendations.push({
      kind: "histogram",
      label: KIND_LABELS.histogram,
      reason: "Continuous numeric sample — distribution view.",
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      kind: "bar",
      label: KIND_LABELS.bar,
      reason: "Default categorical comparison.",
    });
  }

  // de-dupe by kind preserving order
  const seen = new Set<GraphKind>();
  return recommendations.filter((item) => {
    if (seen.has(item.kind)) {
      return false;
    }
    seen.add(item.kind);
    return true;
  });
};

export const parseDatasetText = (raw: string): {
  categories: string[];
  values: number[];
  points: GraphSeriesPoint[];
  looksLikeTime: boolean;
  errors: string[];
} => {
  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const categories: string[] = [];
  const values: number[] = [];
  const points: GraphSeriesPoint[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    const parts = line.split(/[,;\t|]+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const y = parseLocaleNumber(parts[1]);
      const xNum = parseLocaleNumber(parts[0]);
      if (Number.isFinite(xNum) && Number.isFinite(y)) {
        points.push({ x: xNum, y });
        continue;
      }
      if (Number.isFinite(y)) {
        categories.push(parts[0]);
        values.push(y);
        continue;
      }
      errors.push(`Could not read numbers in: "${line}" (use 12 or ১২)`);
    } else if (parts.length === 1) {
      const only = parseLocaleNumber(parts[0]);
      if (Number.isFinite(only)) {
        values.push(only);
      } else {
        errors.push(`Could not read number in: "${line}"`);
      }
    }
  }

  const looksLikeTime = categories.some((c) =>
    /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}|q[1-4]|জানু|ফেব্রু|মার্চ|এপ্রিল|মে|জুন|জুল|আগস্ট|সেপ্ট|অক্টো|নভে|ডিসে/i.test(
      normalizeIndicDigits(c),
    ),
  );

  return { categories, values, points, looksLikeTime, errors };
};
