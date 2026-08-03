"use client";

import DOMPurify from "dompurify";
import katex from "katex";
import { useEffect, useMemo, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { parseGraphDefinition } from "@/utils/exam/graph/graphTypes";
import "katex/dist/katex.min.css";
import "./richTextEditor.css";

type RichTextContentProps = {
  html: string;
  className?: string;
};

const renderMathInHtml = (html: string): string => {
  if (typeof window === "undefined" || !html) {
    return html;
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  container.querySelectorAll('[data-type="math"]').forEach((node) => {
    const latex = node.getAttribute("data-latex") ?? node.textContent ?? "";
    const display = node.getAttribute("data-display") === "true";

    try {
      node.innerHTML = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: display,
      });
      node.classList.add(display ? "rte-math-block" : "rte-math-inline");
    } catch {
      node.textContent = latex;
    }
  });

  return container.innerHTML;
};

const RichTextContent = ({ html, className = "" }: RichTextContentProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const rootsRef = useRef<Root[]>([]);

  const sanitized = useMemo(() => {
    if (!html) {
      return "";
    }

    const clean = DOMPurify.sanitize(html, {
      ADD_ATTR: [
        "data-type",
        "data-latex",
        "data-display",
        "data-align",
        "data-kind",
        "data-caption",
        "data-graph",
        "data-preview",
        "style",
        "class",
        "target",
        "rel",
        "width",
        "colspan",
        "rowspan",
        "colwidth",
      ],
      ADD_TAGS: [
        "span",
        "div",
        "img",
        "figure",
        "figcaption",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "colgroup",
        "col",
      ],
    });

    return renderMathInHtml(clean);
  }, [html]);

  useEffect(() => {
    const host = hostRef.current;
    rootsRef.current.forEach((root) => root.unmount());
    rootsRef.current = [];
    if (!host) {
      return;
    }

    const nodes = host.querySelectorAll<HTMLElement>('[data-type="editor-graph"]');
    void (async () => {
      const GraphRenderer = (await import("./graph/GraphRenderer")).default;
      const React = await import("react");
      nodes.forEach((node) => {
        const definition = parseGraphDefinition(node.getAttribute("data-graph"));
        const preview = node.getAttribute("data-preview");
        if (!definition) {
          if (preview) {
            node.innerHTML = `<img src="${preview}" alt="Graph" style="max-width:100%;height:auto;" />`;
          }
          return;
        }
        node.innerHTML = "";
        const root = createRoot(node);
        rootsRef.current.push(root);
        root.render(React.createElement(GraphRenderer, { definition }));
      });
    })();

    return () => {
      rootsRef.current.forEach((root) => root.unmount());
      rootsRef.current = [];
    };
  }, [sanitized]);

  if (!sanitized) {
    return null;
  }

  return (
    <div
      ref={hostRef}
      className={`rte-content rte-readonly ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export default RichTextContent;
