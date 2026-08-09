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
import { EditorGraph } from "./extensions/EditorGraph";
import { MathFormula } from "./extensions/MathFormula";
import { ResizableImage } from "./extensions/ResizableImage";

const linkExtension = Link.configure({
  openOnClick: false,
  autolink: true,
  linkOnPaste: true,
  HTMLAttributes: {
    class: "rte-link",
    rel: "noopener noreferrer nofollow",
  },
});

/**
 * TipTap 3 StarterKit already ships link / underline / gapcursor.
 * Disable those copies so we can configure them once ourselves.
 */
export const createRichTextExtensions = (placeholder: string) => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    bulletList: { keepMarks: true, keepAttributes: true },
    orderedList: { keepMarks: true, keepAttributes: true },
    horizontalRule: {},
    // TipTap 3 StarterKit already includes these — keep one configured copy below.
    gapcursor: false,
    link: false,
    underline: false,
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
  linkExtension,
  ResizableImage,
  Table.configure({
    resizable: true,
    allowTableNodeSelection: true,
    cellMinWidth: 120,
    handleWidth: 6,
    HTMLAttributes: {
      class: "rte-table",
    },
  }),
  TableRow,
  TableHeader.configure({
    HTMLAttributes: {
      class: "rte-table-header",
      style:
        "border: 1px solid #b8bcb8; padding: 8px 10px; vertical-align: top; min-width: 120px; background-color: #f3f5f3; font-weight: 600;",
    },
  }),
  TableCell.configure({
    HTMLAttributes: {
      class: "rte-table-cell",
      style: "border: 1px solid #b8bcb8; padding: 8px 10px; vertical-align: top; min-width: 120px;",
    },
  }),
  EditorGraph,
  Typography,
  Placeholder.configure({
    placeholder,
  }),
  MathFormula,
];

/** Lean TipTap set for the Chemistry Workspace (faster to load than the full editor). */
export const createChemistryRichTextExtensions = (placeholder: string) => [
  StarterKit.configure({
    heading: false,
    codeBlock: false,
    blockquote: false,
    horizontalRule: false,
    gapcursor: false,
    link: false,
    underline: false,
  }),
  Gapcursor,
  Underline,
  Subscript,
  Superscript,
  TextStyle,
  linkExtension,
  ResizableImage,
  Placeholder.configure({ placeholder }),
];
