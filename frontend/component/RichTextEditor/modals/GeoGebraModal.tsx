"use client";

import SketchFigureModal from "./SketchFigureModal";

type GeoGebraModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
};

/** Geometry figure inserter — simple draw canvas (replaces heavy GeoGebra embed). */
const GeoGebraModal = ({ open, onClose, onInsert }: GeoGebraModalProps) => (
  <SketchFigureModal
    open={open}
    title="Insert geometry figure"
    hint="Sketch triangles, circles, angles, or coordinate diagrams with shapes and lines. Or upload an image of a figure."
    insertLabel="Insert figure"
    allowUpload
    onClose={onClose}
    onInsert={onInsert}
  />
);

export default GeoGebraModal;
