import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";
import { GeometryPlaceholder } from "./extensions/GeometryPlaceholder";
import { MathFormula } from "./extensions/MathFormula";

export const createRichTextExtensions = (placeholder: string) => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    bulletList: { keepMarks: true, keepAttributes: true },
    orderedList: { keepMarks: true, keepAttributes: true },
  }),
  Underline,
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: "rte-link",
      rel: "noopener noreferrer nofollow",
    },
  }),
  Image.configure({
    allowBase64: true,
    HTMLAttributes: {
      class: "rte-image",
    },
  }),
  Table.configure({
    resizable: false,
    HTMLAttributes: {
      class: "rte-table",
    },
  }),
  TableRow,
  TableHeader,
  TableCell,
  Placeholder.configure({
    placeholder,
  }),
  MathFormula,
  GeometryPlaceholder,
];
