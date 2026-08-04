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
    hint="Use the Equation box for formulas (type a^2 for a²). Shape tools and labels are below."
    insertLabel="Insert figure"
    onClose={onClose}
    onInsert={onInsert}
  />
);

export default GeometryFigureModal;
