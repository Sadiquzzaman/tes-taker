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
    hint="Grid + snap on. Use Shapes, Construction, and Labels — or Eq… for a custom formula. Upload image if you already have a figure."
    insertLabel="Insert figure"
    onClose={onClose}
    onInsert={onInsert}
  />
);

export default GeometryFigureModal;
