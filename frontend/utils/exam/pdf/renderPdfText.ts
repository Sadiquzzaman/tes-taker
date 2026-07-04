import type { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { containsBengaliScript } from "./bengaliText";
import { PDF_BENGALI_FONT_PATH, PDF_ENGLISH_FONT_NAME } from "./pdfConstants";

const BENGALI_FONT_FAMILY = "NotoSansBengaliPDF";
const MM_TO_PX = 3.7795275591;

let bengaliFontLoaded = false;

const ensureBengaliFontFace = async (): Promise<void> => {
  if (bengaliFontLoaded || typeof document === "undefined") {
    return;
  }

  const fontFace = new FontFace(BENGALI_FONT_FAMILY, `url(${PDF_BENGALI_FONT_PATH})`, {
    style: "normal",
    weight: "400",
  });

  await fontFace.load();
  document.fonts.add(fontFace);
  bengaliFontLoaded = true;
};

const mmToPx = (mm: number): number => mm * MM_TO_PX;

export const setPdfLatinFont = (
  doc: jsPDF,
  style: "normal" | "bold" | "italic" = "normal",
): void => {
  doc.setFont(PDF_ENGLISH_FONT_NAME, style);
};

const renderLatinTextBlock = (
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  align: "left" | "center" | "right",
  maxWidthMm: number,
): number => {
  if (align === "center") {
    doc.text(lines, x, y, { align: "center", maxWidth: maxWidthMm });
  } else if (align === "right") {
    doc.text(lines, x, y, { align: "right", maxWidth: maxWidthMm });
  } else {
    doc.text(lines, x, y, { maxWidth: maxWidthMm });
  }

  return y + lines.length * lineHeight;
};

const BENGALI_CANVAS_PADDING_TOP_PX = 2;
/** Extra room below the baseline for Bengali vowel marks and descenders. */
const BENGALI_CANVAS_PADDING_BOTTOM_PX = 10;

const renderBengaliTextBlock = async (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidthMm: number,
  fontSizePt: number,
  fontWeight: "normal" | "bold" = "normal",
  align: "left" | "center" | "right" = "left",
): Promise<number> => {
  await ensureBengaliFontFace();
  await document.fonts.ready;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = `${mmToPx(maxWidthMm)}px`;
  container.style.fontFamily = `'${BENGALI_FONT_FAMILY}', 'Noto Sans Bengali', sans-serif`;
  container.style.fontSize = `${fontSizePt}pt`;
  container.style.fontWeight = fontWeight;
  container.style.color = "#000000";
  container.style.lineHeight = "1.65";
  container.style.whiteSpace = "pre-wrap";
  container.style.wordBreak = "break-word";
  container.style.textAlign = align;
  container.style.overflow = "visible";
  container.style.boxSizing = "border-box";
  container.style.paddingTop = `${BENGALI_CANVAS_PADDING_TOP_PX}px`;
  container.style.paddingBottom = `${BENGALI_CANVAS_PADDING_BOTTOM_PX}px`;
  container.textContent = text;

  document.body.appendChild(container);

  try {
    const captureHeight = container.scrollHeight;

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: null,
      logging: false,
      useCORS: true,
      height: captureHeight,
      windowHeight: captureHeight,
      onclone: (_doc, clonedElement) => {
        clonedElement.style.overflow = "visible";
        clonedElement.style.paddingBottom = `${BENGALI_CANVAS_PADDING_BOTTOM_PX}px`;
      },
    });

    const imgWidth = maxWidthMm;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;
    const imgX = align === "center" ? x - imgWidth / 2 : align === "right" ? x - imgWidth : x;
    doc.addImage(canvas.toDataURL("image/png"), "PNG", imgX, y, imgWidth, imgHeight);
    return y + imgHeight + 1;
  } finally {
    document.body.removeChild(container);
  }
};

export const renderPdfTextBlock = async (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidthMm: number,
  lineHeight: number,
  options: {
    fontSize?: number;
    style?: "normal" | "bold" | "italic";
    align?: "left" | "center" | "right";
  } = {},
): Promise<number> => {
  const fontSize = options.fontSize ?? doc.getFontSize();
  const align = options.align ?? "left";
  doc.setFontSize(fontSize);

  if (containsBengaliScript(text)) {
    const fontWeight = options.style === "bold" ? "bold" : "normal";
    return renderBengaliTextBlock(doc, text, x, y, maxWidthMm, fontSize, fontWeight, align);
  }

  setPdfLatinFont(doc, options.style ?? "normal");
  const lines = doc.splitTextToSize(text, maxWidthMm) as string[];
  return renderLatinTextBlock(doc, lines, x, y, lineHeight, align, maxWidthMm);
};

export const wrapLatinText = (doc: jsPDF, text: string, maxWidthMm: number): string[] => {
  setPdfLatinFont(doc, "normal");
  return doc.splitTextToSize(text, maxWidthMm) as string[];
};
