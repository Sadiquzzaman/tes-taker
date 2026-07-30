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
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    resizableImage: {
      setResizableImage: (attrs: ResizableImageAttrs) => ReturnType;
    };
  }
}

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
    };
  },

  parseHTML() {
    return [
      { tag: "figure[data-type='resizable-image']" },
      { tag: 'img[src][data-kind]' },
      { tag: "img[src]" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, ...imgAttrs } = HTMLAttributes as ResizableImageAttrs & Record<string, unknown>;
    if (caption) {
      return [
        "figure",
        { "data-type": "resizable-image", "data-align": imgAttrs.align, "data-kind": imgAttrs.kind, "data-caption": caption },
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
    };
  },
});
