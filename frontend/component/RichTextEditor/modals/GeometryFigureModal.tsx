"use client";

import SketchFigureModal from "./SketchFigureModal";

type GeometryFigureModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
};

const GeometryFigureModal = ({ open, onClose, onInsert }: GeometryFigureModalProps) => (
  <SketchFigureModal
    open={open}
    mode="geometry"
    title="Insert geometry figure"
    hint="CAD-lite drawing: grid and snap are on. Use the tools above for lines, shapes, angles, and length labels — or upload an image."
    insertLabel="Insert figure"
    onClose={onClose}
    onInsert={onInsert}
  />
);

export default GeometryFigureModal;
