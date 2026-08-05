"use client";

import { Editor } from "ketcher-react";
import type { Ketcher } from "ketcher-core";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "ketcher-react/dist/index.css";
import {
  blobToDataUrl,
  parseFigureDocument,
  serializeFigureDocument,
  type ChemistryDocumentV1,
  type FigureInsertPayload,
} from "@/utils/figures/figureTypes";

type ChemistryFigureModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (payload: FigureInsertPayload) => void;
  initialDocumentJson?: string | null;
};

const ChemistryFigureModal = ({ open, onClose, onInsert, initialDocumentJson }: ChemistryFigureModalProps) => {
  const ketcherRef = useRef<Ketcher | null>(null);
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
          setError(err instanceof Error ? err.message : "Failed to load chemistry engine");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const loadInitial = useCallback(
    async (ketcher: Ketcher) => {
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
    (ketcher: Ketcher) => {
      ketcherRef.current = ketcher;
      setReady(true);
      void loadInitial(ketcher);
    },
    [loadInitial],
  );

  const handleInsert = async () => {
    const ketcher = ketcherRef.current;
    if (!ketcher) {
      setError("Chemistry editor is still loading.");
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
        throw new Error("Draw a structure before inserting.");
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
      setError(err instanceof Error ? err.message : "Failed to insert chemistry figure");
    } finally {
      setBusy(false);
    }
  };

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="rte-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="rte-modal rte-modal--wide rte-figure-modal rte-figure-modal--ketcher"
        role="dialog"
        aria-modal="true"
        aria-label="Insert chemistry figure"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="rte-modal__header">
          <h3>Insert chemistry figure</h3>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="rte-modal__hint">
          Draw molecules and reactions with Ketcher. Insert stores SVG for display and MOL/KET for later editing.
        </p>

        <div className="rte-ketcher-host">
          {structServiceProvider ? (
            <Editor
              staticResourcesUrl=""
              structServiceProvider={structServiceProvider}
              errorHandler={(message) => setError(String(message))}
              onInit={handleInit}
              disableMacromoleculesEditor
            />
          ) : null}
        </div>

        {!ready ? <p className="rte-modal__hint">Loading chemistry editor…</p> : null}
        {error ? <p className="rte-modal__error">{error}</p> : null}

        <div className="rte-modal__actions rte-modal__actions--sticky">
          <button type="button" className="rte-modal__ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="rte-modal__primary" onClick={handleInsert} disabled={busy || !ready}>
            {busy ? "Saving…" : "Insert figure"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ChemistryFigureModal;
