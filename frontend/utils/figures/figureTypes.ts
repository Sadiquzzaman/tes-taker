export type FigureKind = "geometry" | "chemistry";

export type ChemistryDocumentV1 = {
  version: 1;
  kind: "chemistry";
  /** Prefer KET; fall back to MOL when reopening */
  ket?: string;
  mol?: string;
  smiles?: string;
  rxn?: string;
};

export type FigureDocument = ChemistryDocumentV1;

export type FigureInsertPayload = {
  src: string;
  kind: "chemistry";
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
    if (parsed.kind !== "chemistry") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });
