"use client";

import DOMPurify from "dompurify";
import katex from "katex";
import { useMemo } from "react";
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
        "style",
        "class",
        "target",
        "rel",
        "width",
        "colspan",
        "rowspan",
      ],
      ADD_TAGS: ["span", "div", "img", "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col"],
    });

    return renderMathInHtml(clean);
  }, [html]);

  if (!sanitized) {
    return null;
  }

  return <div className={`rte-content rte-readonly ${className}`.trim()} dangerouslySetInnerHTML={{ __html: sanitized }} />;
};

export default RichTextContent;
