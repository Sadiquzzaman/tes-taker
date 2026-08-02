import type { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import katex from "katex";
import { ensureSpace, PDF_PAGE_MARGIN } from "./pdfLayout";
import { getPlainTextFromHtml } from "@/utils/richText";
import { renderPdfTextBlock } from "./renderPdfText";

const MM_TO_PX = 3.7795275591;

const hasRichPdfContent = (html: string): boolean => {
  if (!html) {
    return false;
  }
  return /<(img|table|h[1-4]|ul|ol|li|blockquote|span[^>]*data-type=["']math["'])/i.test(html);
};

const prepareHtmlForPdf = (html: string): string => {
  if (typeof document === "undefined") {
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
    } catch {
      node.textContent = latex;
    }
  });

  container.querySelectorAll('[data-type="editor-graph"]').forEach((node) => {
    const preview = node.getAttribute("data-preview");
    const kind = node.getAttribute("data-graph") || "";
    if (preview) {
      node.innerHTML = `<img src="${preview}" alt="Graph" style="max-width:100%;height:auto;" />`;
      return;
    }
    let label = "Graph";
    try {
      const parsed = JSON.parse(kind) as { kind?: string; title?: string };
      label = parsed.title || parsed.kind || "Graph";
    } catch {
      // keep default
    }
    node.innerHTML = `<p><em>[${label}]</em></p>`;
  });

  container.querySelectorAll("img").forEach((img) => {
    img.style.maxWidth = "100%";
    img.style.height = "auto";
  });

  container.querySelectorAll("table").forEach((table) => {
    (table as HTMLElement).style.borderCollapse = "collapse";
    (table as HTMLElement).style.width = "100%";
  });

  container.querySelectorAll("th, td").forEach((cell) => {
    (cell as HTMLElement).style.border = "1px solid #999";
    (cell as HTMLElement).style.padding = "4px 6px";
  });

  return container.innerHTML;
};

/**
 * Renders rich HTML (math, images, tables, headings) into the PDF via off-screen capture.
 * Falls back to plain text when content is simple or capture fails.
 */
export const renderPdfRichHtml = async (
  doc: jsPDF,
  html: string,
  x: number,
  y: number,
  maxWidthMm: number,
  lineHeight: number,
  options?: { fontSize?: number; style?: "normal" | "bold" | "italic"; prefix?: string },
): Promise<number> => {
  const prefix = options?.prefix ?? "";
  const plain = `${prefix}${getPlainTextFromHtml(html)}`.trim();

  if (!hasRichPdfContent(html) || typeof document === "undefined") {
    return renderPdfTextBlock(doc, plain || " ", x, y, maxWidthMm, lineHeight, {
      fontSize: options?.fontSize ?? 11,
      style: options?.style ?? "normal",
    });
  }

  try {
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-12000px";
    host.style.top = "0";
    host.style.width = `${maxWidthMm * MM_TO_PX}px`;
    host.style.padding = "4px";
    host.style.background = "#ffffff";
    host.style.color = "#000000";
    host.style.fontFamily = "Helvetica, Arial, sans-serif";
    host.style.fontSize = `${options?.fontSize ?? 11}pt`;
    host.style.lineHeight = "1.45";
    host.style.fontWeight = options?.style === "bold" ? "700" : "400";
    host.innerHTML = `${prefix ? `<strong>${prefix}</strong> ` : ""}${prepareHtmlForPdf(html)}`;
    document.body.appendChild(host);

    // Ensure katex CSS is present for capture
    if (!document.querySelector("style[data-pdf-katex]")) {
      try {
        const katexCss = await import("katex/dist/katex.min.css");
        void katexCss;
      } catch {
        // CSS may already be loaded via app styles
      }
      const style = document.createElement("style");
      style.setAttribute("data-pdf-katex", "true");
      document.head.appendChild(style);
    }

    await document.fonts.ready;
    const canvas = await html2canvas(host, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    document.body.removeChild(host);

    const imgWidth = maxWidthMm;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;
    let cursorY = ensureSpace(doc, y, Math.min(imgHeight, 80));
    const pageHeight = doc.internal.pageSize.getHeight() - PDF_PAGE_MARGIN;
    let remainingHeight = imgHeight;
    let sourceY = 0;
    const pageImgHeightMax = pageHeight - cursorY;

    if (imgHeight <= pageImgHeightMax) {
      doc.addImage(canvas.toDataURL("image/png"), "PNG", x, cursorY, imgWidth, imgHeight);
      return cursorY + imgHeight + 2;
    }

    // Slice tall content across pages
    while (remainingHeight > 0) {
      const sliceHeightMm = Math.min(remainingHeight, pageHeight - PDF_PAGE_MARGIN - 4);
      const sliceHeightPx = (sliceHeightMm / imgHeight) * canvas.height;
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.max(1, Math.round(sliceHeightPx));
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) {
        break;
      }
      ctx.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceCanvas.height,
        0,
        0,
        canvas.width,
        sliceCanvas.height,
      );
      cursorY = ensureSpace(doc, cursorY, sliceHeightMm);
      doc.addImage(sliceCanvas.toDataURL("image/png"), "PNG", x, cursorY, imgWidth, sliceHeightMm);
      cursorY += sliceHeightMm + 2;
      sourceY += sliceCanvas.height;
      remainingHeight -= sliceHeightMm;
      if (remainingHeight > 0) {
        doc.addPage();
        cursorY = PDF_PAGE_MARGIN;
      }
    }

    return cursorY;
  } catch {
    return renderPdfTextBlock(doc, plain || " ", x, y, maxWidthMm, lineHeight, {
      fontSize: options?.fontSize ?? 11,
      style: options?.style ?? "normal",
    });
  }
};
