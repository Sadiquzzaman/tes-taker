"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  blobToDataUrl,
  parseFigureDocument,
  serializeFigureDocument,
  type ChemistryDocumentV1,
  type FigureInsertPayload,
} from "@/utils/figures/figureTypes";

/** Minimal Ketcher API surface — avoids importing ketcher-core in this shell module. */
type KetcherApi = {
  setMolecule: (struct: string) => Promise<void | undefined>;
  getKet: () => Promise<string>;
  getMolfile: () => Promise<string>;
  getSmiles: () => Promise<string>;
  getRxn: () => Promise<string>;
  generateImage: (data: string, options?: { outputFormat: "svg" | "png" }) => Promise<Blob>;
};

const KetcherStructureEditor = dynamic(() => import("./KetcherStructureEditor"), {
  ssr: false,
  loading: () => <p className="rte-modal__hint">Loading drawing tool…</p>,
});

type KetcherStructureDialogProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (payload: FigureInsertPayload) => void;
  initialDocumentJson?: string | null;
};

const KetcherStructureDialog = ({
  open,
  onClose,
  onInsert,
  initialDocumentJson,
}: KetcherStructureDialogProps) => {
  const ketcherRef = useRef<KetcherApi | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Ketcher provider has no stable public type export
  const [structServiceProvider, setStructServiceProvider] = useState<any>(null);

  useEffect(() => {
    if (!open) {
      ketcherRef.current = null;
      setReady(false);
      setError("");
      setBusy(false);
      setStructServiceProvider(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const mod = await import("ketcher-standalone/dist/binaryWasm");
        if (cancelled) {
          return;
        }
        setStructServiceProvider(new mod.StandaloneStructServiceProvider());
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load chemistry drawing tool");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const loadInitial = useCallback(
    async (ketcher: KetcherApi) => {
      const parsed = parseFigureDocument(initialDocumentJson);
      if (!parsed || parsed.kind !== "chemistry") {
        return;
      }
      const payload = parsed.ket || parsed.mol || parsed.rxn || parsed.smiles;
      if (!payload?.trim()) {
        return;
      }
      try {
        await ketcher.setMolecule(payload);
      } catch {
        // Invalid legacy payload — leave empty canvas
      }
    },
    [initialDocumentJson],
  );

  const handleInit = useCallback(
    (ketcher: KetcherApi) => {
      ketcherRef.current = ketcher;
      setReady(true);
      void loadInitial(ketcher);
    },
    [loadInitial],
  );

  const handleDone = async () => {
    const ketcher = ketcherRef.current;
    if (!ketcher) {
      setError("Chemistry drawing tool is still loading.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const [ket, mol, smiles, rxn] = await Promise.all([
        ketcher.getKet().catch(() => ""),
        ketcher.getMolfile().catch(() => ""),
        ketcher.getSmiles().catch(() => ""),
        ketcher.getRxn().catch(() => ""),
      ]);

      if (!ket?.trim() && !mol?.trim()) {
        throw new Error("Draw a structure before tapping Done.");
      }

      const structureForImage = mol || ket;
      const blob = await ketcher.generateImage(structureForImage, {
        outputFormat: "svg",
      });
      const src = await blobToDataUrl(blob);

      const doc: ChemistryDocumentV1 = {
        version: 1,
        kind: "chemistry",
        ket: ket || undefined,
        mol: mol || undefined,
        smiles: smiles || undefined,
        rxn: rxn || undefined,
      };

      onInsert({
        src,
        kind: "chemistry",
        figureJson: serializeFigureDocument(doc),
        figureFormat: "svg",
        mol: mol || null,
        smiles: smiles || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save chemical structure");
    } finally {
      setBusy(false);
    }
  };

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="rte-modal-backdrop chem-ketcher-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="rte-modal rte-modal--wide rte-figure-modal rte-figure-modal--ketcher"
        role="dialog"
        aria-modal="true"
        aria-label="Draw chemical structure"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="rte-modal__header">
          <h3>Draw chemical structure</h3>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="rte-modal__hint">Draw the molecule, then tap Done to place it in your chemistry question.</p>

        <div className="rte-ketcher-host">
          {structServiceProvider ? (
            <KetcherStructureEditor
              structServiceProvider={structServiceProvider}
              onInit={handleInit}
              onError={setError}
            />
          ) : null}
        </div>

        {!ready && !error ? <p className="rte-modal__hint">Loading drawing tool…</p> : null}
        {error ? <p className="rte-modal__error">{error}</p> : null}

        <div className="rte-modal__actions rte-modal__actions--sticky chem-actions">
          <button type="button" className="rte-modal__ghost chem-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="rte-modal__primary chem-btn chem-btn--primary"
            onClick={handleDone}
            disabled={busy || !ready}
          >
            {busy ? "Saving…" : "Done"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default KetcherStructureDialog;
