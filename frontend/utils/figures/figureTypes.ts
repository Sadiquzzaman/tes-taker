export type FigureKind = "geometry" | "chemistry";

export type GeometryDocumentV1 = {
  version: 1;
  kind: "geometry";
  boundingBox: [number, number, number, number];
  axis: boolean;
  grid: boolean;
  /** JessieCode snapshot for re-editing in JSXGraph */
  jessieCode: string;
};

export type ChemistryDocumentV1 = {
  version: 1;
  kind: "chemistry";
  /** Prefer KET; fall back to MOL when reopening */
  ket?: string;
  mol?: string;
  smiles?: string;
  rxn?: string;
};

export type FigureDocument = GeometryDocumentV1 | ChemistryDocumentV1;

export type FigureInsertPayload = {
  src: string;
  kind: FigureKind;
  figureJson: string;
  figureFormat: "svg" | "png";
  mol?: string | null;
  smiles?: string | null;
};

export const serializeFigureDocument = (doc: FigureDocument): string => JSON.stringify(doc);

export const parseFigureDocument = (raw: string | null | undefined): FigureDocument | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as FigureDocument;
    if (!parsed || typeof parsed !== "object" || !("version" in parsed) || !("kind" in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const svgToDataUrl = (svg: string): string => {
  const trimmed = svg.trim().startsWith("<svg") ? svg.trim() : `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`;
};

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });
