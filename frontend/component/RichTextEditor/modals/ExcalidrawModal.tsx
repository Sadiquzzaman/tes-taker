"use client";

import SketchFigureModal from "./SketchFigureModal";

type ExcalidrawModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
};

const ExcalidrawModal = ({ open, onClose, onInsert }: ExcalidrawModalProps) => (
  <SketchFigureModal
    open={open}
    title="Insert drawing"
    hint="Draw lines, arrows, shapes, and flowcharts. Insert the diagram into your question when ready."
    insertLabel="Insert drawing"
    onClose={onClose}
    onInsert={onInsert}
  />
);

export default ExcalidrawModal;
