import { mergeAttributes, Node } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    geometryPlaceholder: {
      insertGeometryPlaceholder: () => ReturnType;
    };
  }
}

/**
 * Lightweight placeholder block for future geometry / diagram tools.
 * Teachers can insert it now; rendering shows a clearly labeled stub.
 */
export const GeometryPlaceholder = Node.create({
  name: "geometryPlaceholder",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="geometry"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "geometry",
        class: "rte-geometry-placeholder",
        contenteditable: "false",
      }),
      ["span", { class: "rte-geometry-placeholder__label" }, "Geometry / diagram block (coming soon)"],
      [
        "span",
        { class: "rte-geometry-placeholder__hint" },
        "Use this placeholder to mark where a figure should appear. Drawing tools will plug in later.",
      ],
    ];
  },

  addCommands() {
    return {
      insertGeometryPlaceholder:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});
