"use client";

import SketchFigureModal from "./SketchFigureModal";

type GeoGebraModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
};

const GeoGebraModal = ({ open, onClose, onInsert }: GeoGebraModalProps) => (
  <SketchFigureModal
    open={open}
    title="Insert geometry figure"
    hint="Upload a figure, or draw shapes, lines, and angles on the canvas."
    insertLabel="Insert figure"
    allowUpload
    defaultMode="upload"
    onClose={onClose}
    onInsert={onInsert}
  />
);

export default GeoGebraModal;
