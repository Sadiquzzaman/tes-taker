"use client";

import { useMemo, useState } from "react";
import {
  createDefaultGraphDefinition,
  getGraphKindLabel,
  listGraphKinds,
  parseDatasetText,
  recommendChartKinds,
  type GraphDefinition,
  type GraphKind,
} from "@/utils/exam/graph/graphTypes";
import GraphRenderer from "../graph/GraphRenderer";

type GraphPanelProps = {
  open: boolean;
  initialDefinition?: GraphDefinition | null;
  onClose: () => void;
  onSave: (definition: GraphDefinition) => void;
};

const GraphPanel = ({ open, initialDefinition, onClose, onSave }: GraphPanelProps) => {
  const [definition, setDefinition] = useState<GraphDefinition>(
    () => initialDefinition ?? createDefaultGraphDefinition("function"),
  );
  const [datasetText, setDatasetText] = useState("");

  const recommendations = useMemo(() => {
    const parsed = parseDatasetText(datasetText);
    return recommendChartKinds({
      categories: parsed.categories,
      values: parsed.values,
      points: parsed.points,
      looksLikeTime: parsed.looksLikeTime,
      partsOfWhole: true,
    });
  }, [datasetText]);

  if (!open) {
    return null;
  }

  const setKind = (kind: GraphKind) => {
    setDefinition((current) => ({
      ...createDefaultGraphDefinition(kind),
      ...current,
      kind,
      title: current.title || getGraphKindLabel(kind),
    }));
  };

  const applyDataset = (kind?: GraphKind) => {
    const parsed = parseDatasetText(datasetText);
    const nextKind = kind ?? recommendations[0]?.kind ?? "bar";
    setDefinition({
      ...createDefaultGraphDefinition(nextKind),
      kind: nextKind,
      categories: parsed.categories.length ? parsed.categories : createDefaultGraphDefinition(nextKind).categories,
      values: parsed.values.length ? parsed.values : createDefaultGraphDefinition(nextKind).values,
      points: parsed.points.length ? parsed.points : createDefaultGraphDefinition(nextKind).points,
      title: getGraphKindLabel(nextKind),
    });
  };

  return (
    <div className="rte-inline-panel" role="dialog" aria-label="Graph editor">
      <div className="rte-inline-panel__header">
        <h3>Insert graph</h3>
        <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p className="rte-modal__hint">
        Graphs stay editable inside the question. Choose a type, adjust data, then insert.
      </p>

      <div className="rte-graph-tabs">
        {listGraphKinds().map((item) => (
          <button
            key={item.kind}
            type="button"
            className={`rte-modal__chip ${definition.kind === item.kind ? "is-active" : ""}`}
            onClick={() => setKind(item.kind)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(definition.kind === "function" || definition.kind === "coordinate") && (
        <div className="rte-inline-panel__grid">
          <label className="rte-modal__field">
            <span>{definition.kind === "coordinate" ? "Primary f(x)" : "f(x) ="}</span>
            <input
              value={definition.expression ?? ""}
              onChange={(event) => setDefinition((current) => ({ ...current, expression: event.target.value }))}
            />
          </label>
          {definition.kind === "coordinate" ? (
            <label className="rte-modal__field">
              <span>Secondary g(x)</span>
              <input
                value={definition.expressionB ?? ""}
                onChange={(event) => setDefinition((current) => ({ ...current, expressionB: event.target.value }))}
              />
            </label>
          ) : null}
          <label className="rte-modal__field">
            <span>x min</span>
            <input
              type="number"
              value={definition.xMin ?? -10}
              onChange={(event) => setDefinition((current) => ({ ...current, xMin: Number(event.target.value) }))}
            />
          </label>
          <label className="rte-modal__field">
            <span>x max</span>
            <input
              type="number"
              value={definition.xMax ?? 10}
              onChange={(event) => setDefinition((current) => ({ ...current, xMax: Number(event.target.value) }))}
            />
          </label>
          <label className="rte-modal__field">
            <span>y min</span>
            <input
              type="number"
              value={definition.yMin ?? -10}
              onChange={(event) => setDefinition((current) => ({ ...current, yMin: Number(event.target.value) }))}
            />
          </label>
          <label className="rte-modal__field">
            <span>y max</span>
            <input
              type="number"
              value={definition.yMax ?? 10}
              onChange={(event) => setDefinition((current) => ({ ...current, yMax: Number(event.target.value) }))}
            />
          </label>
        </div>
      )}

      {definition.kind !== "function" && definition.kind !== "coordinate" && definition.kind !== "surface3d" ? (
        <div className="rte-inline-panel__dataset">
          <label className="rte-modal__field">
            <span>Dataset (label,value per line or x,y for scatter)</span>
            <textarea
              rows={5}
              value={datasetText}
              onChange={(event) => setDatasetText(event.target.value)}
              placeholder={"Math,12\nScience,19\nEnglish,8"}
            />
          </label>
          {datasetText.trim() ? (
            <div className="rte-ocr-summary">
              <p>
                <strong>Recommended:</strong> {recommendations[0]?.label} — {recommendations[0]?.reason}
              </p>
              <div className="rte-graph-tabs">
                {recommendations.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    className="rte-modal__chip"
                    onClick={() => applyDataset(item.kind)}
                  >
                    Use {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <button type="button" className="rte-modal__secondary" onClick={() => applyDataset()}>
            Apply dataset
          </button>
        </div>
      ) : null}

      <div className="rte-graph-host">
        <GraphRenderer definition={definition} interactive />
      </div>

      <div className="rte-modal__actions">
        <button type="button" className="rte-modal__secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="rte-modal__primary" onClick={() => onSave(definition)}>
          Insert graph
        </button>
      </div>
    </div>
  );
};

export default GraphPanel;
