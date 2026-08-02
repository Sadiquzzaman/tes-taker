"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import dynamic from "next/dynamic";
import { parseGraphDefinition } from "@/utils/exam/graph/graphTypes";

const GraphRenderer = dynamic(() => import("../graph/GraphRenderer"), { ssr: false });

const EditorGraphView = ({ node, selected, getPos }: NodeViewProps) => {
  const definition = parseGraphDefinition(node.attrs.definition) ?? null;
  const previewSrc = (node.attrs.previewSrc as string | null) || null;

  return (
    <NodeViewWrapper
      as="div"
      className={`rte-editor-graph-wrap ${selected ? "rte-node-selected" : ""}`}
      contentEditable={false}
      data-type="editor-graph"
    >
      <div className="rte-editor-graph-frame">
        {definition ? (
          <GraphRenderer definition={definition} />
        ) : previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt="Graph" className="rte-graph-fallback-img" />
        ) : (
          <p className="rte-modal__hint">Invalid graph definition</p>
        )}
      </div>
      <div className="rte-editor-graph-actions">
        <button
          type="button"
          className="rte-modal__chip"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const pos = typeof getPos === "function" ? getPos() : null;
            window.dispatchEvent(
              new CustomEvent("rte:edit-graph", {
                detail: {
                  definitionJson: node.attrs.definition as string,
                  pos: typeof pos === "number" ? pos : null,
                },
              }),
            );
          }}
        >
          Edit graph
        </button>
      </div>
    </NodeViewWrapper>
  );
};

export default EditorGraphView;
