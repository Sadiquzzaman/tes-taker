"use client";

import SketchFigureModal from "./SketchFigureModal";

type ChemistryFigureModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
};

const ChemistryFigureModal = ({ open, onClose, onInsert }: ChemistryFigureModalProps) => (
  <SketchFigureModal
    open={open}
    mode="chemistry"
    title="Insert chemistry figure"
    hint="In the Equation box, type normal letters/numbers (H2O, ->). Bottom numbers are automatic."
    insertLabel="Insert structure"
    onClose={onClose}
    onInsert={onInsert}
  />
);

export default ChemistryFigureModal;
