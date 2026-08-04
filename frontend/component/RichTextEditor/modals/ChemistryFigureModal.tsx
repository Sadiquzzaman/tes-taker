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
    hint="Tap reaction arrows, rings, and common labels, then sketch freely. Or upload a structure photo from a textbook."
    insertLabel="Insert structure"
    onClose={onClose}
    onInsert={onInsert}
  />
);

export default ChemistryFigureModal;
