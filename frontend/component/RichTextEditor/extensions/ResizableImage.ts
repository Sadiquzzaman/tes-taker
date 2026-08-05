import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ResizableImageView from "../node-views/ResizableImageView";

export type ResizableImageAttrs = {
  src: string;
  alt?: string;
  title?: string;
  width?: string | null;
  align?: "left" | "center" | "right";
  kind?: "image" | "geometry" | "chemistry";
  caption?: string;
  /** Serialized GeometryDocument / ChemistryDocument JSON for re-edit */
  figureJson?: string | null;
  figureFormat?: "svg" | "png" | null;
  mol?: string | null;
  smiles?: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    resizableImage: {
      setResizableImage: (attrs: ResizableImageAttrs) => ReturnType;
      updateResizableImageAtPos: (pos: number, attrs: Partial<ResizableImageAttrs>) => ReturnType;
    };
  }
}

const readAttr = (element: HTMLElement, name: string) => element.getAttribute(name);

export const ResizableImage = Node.create({
  name: "resizableImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width") || (element as HTMLElement).style.width || null,
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {}),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
        renderHTML: (attributes) => ({ "data-align": attributes.align }),
      },
      kind: {
        default: "image",
        parseHTML: (element) => element.getAttribute("data-kind") || "image",
        renderHTML: (attributes) => ({ "data-kind": attributes.kind }),
      },
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") || "",
        renderHTML: (attributes) => (attributes.caption ? { "data-caption": attributes.caption } : {}),
      },
      figureJson: {
        default: null,
        parseHTML: (element) => readAttr(element as HTMLElement, "data-figure-json"),
        renderHTML: (attributes) =>
          attributes.figureJson ? { "data-figure-json": attributes.figureJson } : {},
      },
      figureFormat: {
        default: null,
        parseHTML: (element) => readAttr(element as HTMLElement, "data-figure-format"),
        renderHTML: (attributes) =>
          attributes.figureFormat ? { "data-figure-format": attributes.figureFormat } : {},
      },
      mol: {
        default: null,
        parseHTML: (element) => readAttr(element as HTMLElement, "data-mol"),
        renderHTML: (attributes) => (attributes.mol ? { "data-mol": attributes.mol } : {}),
      },
      smiles: {
        default: null,
        parseHTML: (element) => readAttr(element as HTMLElement, "data-smiles"),
        renderHTML: (attributes) => (attributes.smiles ? { "data-smiles": attributes.smiles } : {}),
      },
    };
  },

  parseHTML() {
    return [
      { tag: "figure[data-type='resizable-image']" },
      { tag: "img[src][data-kind]" },
      { tag: "img[src]" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, ...imgAttrs } = HTMLAttributes as ResizableImageAttrs & Record<string, unknown>;
    if (caption) {
      return [
        "figure",
        {
          "data-type": "resizable-image",
          "data-align": imgAttrs.align,
          "data-kind": imgAttrs.kind,
          "data-caption": caption,
          ...(imgAttrs.figureJson ? { "data-figure-json": imgAttrs.figureJson } : {}),
          ...(imgAttrs.figureFormat ? { "data-figure-format": imgAttrs.figureFormat } : {}),
          ...(imgAttrs.mol ? { "data-mol": imgAttrs.mol } : {}),
          ...(imgAttrs.smiles ? { "data-smiles": imgAttrs.smiles } : {}),
        },
        ["img", mergeAttributes(imgAttrs, { class: "rte-image" })],
        ["figcaption", {}, String(caption)],
      ];
    }
    return [
      "img",
      mergeAttributes(imgAttrs, {
        class: "rte-image",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },

  addCommands() {
    return {
      setResizableImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
      updateResizableImageAtPos:
        (pos, attrs) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) {
            return false;
          }
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
            dispatch(tr);
          }
          return true;
        },
    };
  },
});
