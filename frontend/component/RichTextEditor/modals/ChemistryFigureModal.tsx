"use client";

import dynamic from "next/dynamic";

/**
 * Legacy entry point — chemistry structures are drawn via Ketcher.
 * Prefer ChemistryWorkspace for authoring text + structures together.
 * Kept as a dynamic wrapper so importing this file never eagerly loads Ketcher.
 */
const ChemistryFigureModal = dynamic(() => import("../chemistry/KetcherStructureDialog"), {
  ssr: false,
});

export default ChemistryFigureModal;
