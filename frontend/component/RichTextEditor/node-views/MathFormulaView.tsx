"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import katex from "katex";
import { useMemo, type MouseEvent } from "react";
import "katex/dist/katex.min.css";

type MathOpenDetail = {
  latex: string;
  display: boolean;
  pos: number;
};

const MathFormulaView = ({ node, selected, getPos }: NodeViewProps) => {
  const latex = String(node.attrs.latex ?? "");
  const display = Boolean(node.attrs.display);

  const html = useMemo(() => {
    try {
      return katex.renderToString(latex || "\\;", {
        throwOnError: false,
        displayMode: display,
      });
    } catch {
      return latex;
    }
  }, [display, latex]);

  const openEditor = () => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") {
      return;
    }

    window.dispatchEvent(
      new CustomEvent<MathOpenDetail>("rte:open-math", {
        detail: { latex, display, pos },
      }),
    );
  };

  return (
    <NodeViewWrapper
      as="span"
      className={`rte-math-node ${display ? "rte-math-block" : "rte-math-inline"} ${
        selected ? "rte-node-selected" : ""
      }`}
      data-type="math"
      data-latex={latex}
      data-display={display ? "true" : "false"}
      contentEditable={false}
      onDoubleClick={(event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        openEditor();
      }}
      title="Double-click to edit equation"
    >
      <span dangerouslySetInnerHTML={{ __html: html }} />
    </NodeViewWrapper>
  );
};

export type { MathOpenDetail };
export default MathFormulaView;
