import Color from "@tiptap/extension-color";
import Gapcursor from "@tiptap/extension-gapcursor";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { MathFormula } from "./extensions/MathFormula";
import { ResizableImage } from "./extensions/ResizableImage";

export const createRichTextExtensions = (placeholder: string) => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    bulletList: { keepMarks: true, keepAttributes: true },
    orderedList: { keepMarks: true, keepAttributes: true },
    horizontalRule: {},
  }),
  Gapcursor,
  Underline,
  Subscript,
  Superscript,
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
    HTMLAttributes: {
      class: "rte-link",
      rel: "noopener noreferrer nofollow",
    },
  }),
  ResizableImage,
  Table.configure({
    resizable: true,
    allowTableNodeSelection: true,
    HTMLAttributes: {
      class: "rte-table",
    },
  }),
  TableRow,
  TableHeader,
  TableCell,
  Typography,
  Placeholder.configure({
    placeholder,
  }),
  MathFormula,
];
