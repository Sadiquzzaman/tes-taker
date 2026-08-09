"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeRichTextHtml } from "@/utils/richText";
import type { FigureInsertPayload } from "@/utils/figures/figureTypes";
import { createChemistryRichTextExtensions } from "../extensions";
import ChemistryKeyboard from "./ChemistryKeyboard";

const KetcherStructureDialog = dynamic(() => import("./KetcherStructureDialog"), { ssr: false });

type ChemistryWorkspaceProps = {
  open: boolean;
  onClose: () => void;
  /** Called with TipTap HTML to insert into the parent question editor */
  onSave: (html: string) => void;
  initialHtml?: string;
};

const isEmptyHtml = (html: string) => {
  const text = html
    .replace(/<img\b[^>]*>/gi, "IMG")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return !text;
};

const ChemistryWorkspace = ({ open, onClose, onSave, initialHtml = "" }: ChemistryWorkspaceProps) => {
  const [structureOpen, setStructureOpen] = useState(false);
  const [structureEdit, setStructureEdit] = useState<{
    pos: number | null;
    figureJson: string | null;
  }>({ pos: null, figureJson: null });
  const [error, setError] = useState("");

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: createChemistryRichTextExtensions("Write your chemistry question here…"),
      content: initialHtml || "",
      editorProps: {
        attributes: {
          class: "rte-content chem-workspace__editor outline-none",
          spellcheck: "true",
        },
      },
    },
    [open],
  );

  useEffect(() => {
    if (!open || !editor) {
      return;
    }
    editor.commands.setContent(initialHtml || "", { emitUpdate: false });
    requestAnimationFrame(() => {
      editor.commands.focus("end");
    });
  }, [editor, initialHtml, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onEditFigure = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          kind: string;
          figureJson: string | null;
          mol: string | null;
          smiles: string | null;
          pos: number | null;
        }>
      ).detail;
      if (!detail || detail.kind !== "chemistry") {
        return;
      }
      let figureJson = detail.figureJson;
      if (!figureJson && (detail.mol || detail.smiles)) {
        figureJson = JSON.stringify({
          version: 1,
          kind: "chemistry",
          mol: detail.mol || undefined,
          smiles: detail.smiles || undefined,
        });
      }
      setStructureEdit({ pos: detail.pos, figureJson });
      setStructureOpen(true);
    };
    window.addEventListener("rte:edit-figure", onEditFigure as EventListener);
    return () => window.removeEventListener("rte:edit-figure", onEditFigure as EventListener);
  }, [open]);

  const insertStructure = useCallback(
    (payload: FigureInsertPayload) => {
      if (!editor) {
        return;
      }
      const attrs = {
        src: payload.src,
        kind: "chemistry" as const,
        align: "center" as const,
        caption: "",
        figureJson: payload.figureJson,
        figureFormat: payload.figureFormat,
        mol: payload.mol ?? null,
        smiles: payload.smiles ?? null,
        width: "240px",
      };

      const apply = (width: string) => {
        if (typeof structureEdit.pos === "number") {
          editor.chain().focus().updateResizableImageAtPos(structureEdit.pos, { ...attrs, width }).run();
        } else {
          editor.chain().focus().setResizableImage({ ...attrs, width }).run();
        }
        setStructureEdit({ pos: null, figureJson: null });
      };

      const image = new window.Image();
      image.onload = () => {
        const natural = image.naturalWidth || 240;
        apply(`${Math.min(320, Math.max(180, Math.round(natural)))}px`);
      };
      image.onerror = () => apply("240px");
      image.src = payload.src;
    },
    [editor, structureEdit.pos],
  );

  const handleSave = () => {
    if (!editor) {
      return;
    }
    const html = normalizeRichTextHtml(editor.getHTML());
    if (isEmptyHtml(html)) {
      setError("Write some chemistry text or add a structure before saving.");
      return;
    }
    onSave(html);
    onClose();
  };

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="chem-workspace-overlay" role="dialog" aria-modal="true" aria-label="Chemistry editor">
      <div className="chem-workspace">
        <header className="chem-workspace__header">
          <div>
            <h2>Chemistry</h2>
            <p>Write formulas and equations, then add molecular structures if needed.</p>
          </div>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close chemistry editor">
            ×
          </button>
        </header>

        <div className="chem-workspace__body">
          <div className="chem-workspace__editor-shell">
            <EditorContent editor={editor} />
          </div>

          <ChemistryKeyboard editor={editor} />

          <button
            type="button"
            className="chem-btn chem-btn--structure"
            onClick={() => {
              setStructureEdit({ pos: null, figureJson: null });
              setStructureOpen(true);
            }}
          >
            Add Chemical Structure
          </button>

          {error ? <p className="rte-modal__error">{error}</p> : null}
        </div>

        <footer className="chem-workspace__footer chem-actions">
          <button type="button" className="rte-modal__ghost chem-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="rte-modal__primary chem-btn chem-btn--primary" onClick={handleSave}>
            Save Chemistry
          </button>
        </footer>
      </div>

      {structureOpen ? (
        <KetcherStructureDialog
          key={`ketcher-${structureEdit.pos ?? "new"}-${structureEdit.figureJson ? "edit" : "new"}`}
          open={structureOpen}
          initialDocumentJson={structureEdit.figureJson}
          onClose={() => {
            setStructureOpen(false);
            setStructureEdit({ pos: null, figureJson: null });
          }}
          onInsert={insertStructure}
        />
      ) : null}
    </div>,
    document.body,
  );
};

export default ChemistryWorkspace;
