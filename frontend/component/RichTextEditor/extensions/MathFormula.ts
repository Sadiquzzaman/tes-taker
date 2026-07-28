import { mergeAttributes, Node } from "@tiptap/core";

export type MathNodeAttrs = {
  latex: string;
  display: boolean;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathFormula: {
      insertMathFormula: (attrs: MathNodeAttrs) => ReturnType;
      updateMathFormula: (attrs: Partial<MathNodeAttrs>) => ReturnType;
    };
  }
}

export const MathFormula = Node.create({
  name: "mathFormula",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex") ?? "",
        renderHTML: (attributes) => ({
          "data-latex": attributes.latex,
        }),
      },
      display: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-display") === "true",
        renderHTML: (attributes) => ({
          "data-display": attributes.display ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="math"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "math",
        class: HTMLAttributes.display ? "rte-math rte-math-block" : "rte-math rte-math-inline",
      }),
      HTMLAttributes.latex || "\\emptyset",
    ];
  },

  addCommands() {
    return {
      insertMathFormula:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
      updateMathFormula:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    };
  },
});
