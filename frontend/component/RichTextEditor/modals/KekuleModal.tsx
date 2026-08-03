"use client";

import SketchFigureModal from "./SketchFigureModal";

type KekuleModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
};

/** Chemistry figure inserter — upload or quick sketch (replaces complex Kekule composer). */
const KekuleModal = ({ open, onClose, onInsert }: KekuleModalProps) => (
  <SketchFigureModal
    open={open}
    title="Insert chemistry figure"
    hint="Upload a structure image from a textbook, or quickly sketch bonds and formulas on the canvas."
    insertLabel="Insert structure"
    allowUpload
    onClose={onClose}
    onInsert={onInsert}
  />
);

export default KekuleModal;
