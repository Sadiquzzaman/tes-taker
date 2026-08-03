"use client";

import SketchFigureModal from "./SketchFigureModal";

type KekuleModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
};

const KekuleModal = ({ open, onClose, onInsert }: KekuleModalProps) => (
  <SketchFigureModal
    open={open}
    title="Insert chemistry figure"
    hint="Upload a structure image, or sketch bonds and formulas on the canvas."
    insertLabel="Insert structure"
    allowUpload
    defaultMode="upload"
    onClose={onClose}
    onInsert={onInsert}
  />
);

export default KekuleModal;
