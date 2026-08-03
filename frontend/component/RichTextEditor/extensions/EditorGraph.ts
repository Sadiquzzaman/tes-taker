import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  createDefaultGraphDefinition,
  serializeGraphDefinition,
  type GraphDefinition,
} from "@/utils/exam/graph/graphTypes";
import EditorGraphView from "../node-views/EditorGraphView";

export type EditorGraphAttrs = {
  definition: string;
  previewSrc: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    editorGraph: {
      setEditorGraph: (definition: GraphDefinition, previewSrc?: string | null) => ReturnType;
      updateEditorGraphAtPos: (pos: number, definition: GraphDefinition, previewSrc?: string | null) => ReturnType;
    };
  }
}

export const EditorGraph = Node.create({
  name: "editorGraph",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      definition: {
        default: serializeGraphDefinition(createDefaultGraphDefinition("function")),
        parseHTML: (element) => element.getAttribute("data-graph") || serializeGraphDefinition(createDefaultGraphDefinition()),
        renderHTML: (attributes) => ({ "data-graph": attributes.definition }),
      },
      previewSrc: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-preview") || element.getAttribute("src"),
        renderHTML: (attributes) => (attributes.previewSrc ? { "data-preview": attributes.previewSrc } : {}),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="editor-graph"]' },
      { tag: 'figure[data-type="editor-graph"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "editor-graph",
        class: "rte-editor-graph",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditorGraphView);
  },

  addCommands() {
    return {
      setEditorGraph:
        (definition, previewSrc = null) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              definition: serializeGraphDefinition(definition),
              previewSrc,
            },
          }),
      updateEditorGraphAtPos:
        (pos, definition, previewSrc = null) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, {
              definition: serializeGraphDefinition(definition),
              previewSrc,
            });
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
