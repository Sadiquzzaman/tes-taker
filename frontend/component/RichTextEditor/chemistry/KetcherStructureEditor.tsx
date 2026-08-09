"use client";

import { Editor } from "ketcher-react";
import type { Ketcher } from "ketcher-core";
import "ketcher-react/dist/index.css";

type KetcherStructureEditorProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  structServiceProvider: any;
  onInit: (ketcher: Ketcher) => void;
  onError: (message: string) => void;
};

// Keep this file as the only place that statically imports ketcher-react.

/**
 * Isolated module so ketcher-react / CSS are only loaded when the dialog opens.
 */
const KetcherStructureEditor = ({ structServiceProvider, onInit, onError }: KetcherStructureEditorProps) => (
  <Editor
    staticResourcesUrl=""
    structServiceProvider={structServiceProvider}
    errorHandler={(message) => onError(String(message))}
    onInit={onInit}
    disableMacromoleculesEditor
  />
);

export default KetcherStructureEditor;
