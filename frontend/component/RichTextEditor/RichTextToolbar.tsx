"use client";

import type { Editor } from "@tiptap/react";
import { useRef, type ChangeEvent } from "react";

type RichTextToolbarProps = {
  editor: Editor | null;
  onRequestImageUpload?: () => void;
  allowImages?: boolean;
};

const ToolbarButton = ({
  active,
  disabled,
  label,
  onClick,
  title,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  title: string;
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    disabled={disabled}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className={`rounded-[4px] px-1.5 py-1 text-[12px] font-[600] leading-none tracking-[-0.02em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
      active ? "bg-[#49734F] text-white" : "bg-transparent text-[#232A25] hover:bg-[#E8EDE9]"
    }`}
  >
    {label}
  </button>
);

const RichTextToolbar = ({ editor, onRequestImageUpload, allowImages = true }: RichTextToolbarProps) => {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const highlightInputRef = useRef<HTMLInputElement>(null);

  if (!editor) {
    return null;
  }

  const insertLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter link URL", previous ?? "https://");

    if (url === null) {
      return;
    }

    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const insertMath = (display: boolean) => {
    const existing = editor.isActive("mathFormula")
      ? (editor.getAttributes("mathFormula").latex as string | undefined)
      : "";
    const latex = window.prompt(
      display ? "Enter block LaTeX equation" : "Enter inline LaTeX equation",
      existing || (display ? "\\frac{a}{b}" : "x^2"),
    );

    if (latex === null) {
      return;
    }

    const trimmed = latex.trim();
    if (!trimmed) {
      return;
    }

    if (editor.isActive("mathFormula")) {
      editor.chain().focus().updateMathFormula({ latex: trimmed, display }).run();
      return;
    }

    editor.chain().focus().insertMathFormula({ latex: trimmed, display }).run();
  };

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    editor.chain().focus().setColor(event.target.value).run();
  };

  const handleHighlightChange = (event: ChangeEvent<HTMLInputElement>) => {
    editor.chain().focus().toggleHighlight({ color: event.target.value }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[#E5E5E5] bg-[#F7F8F7] px-2 py-1.5">
      <ToolbarButton
        title="Bold (Ctrl+B)"
        label="B"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        title="Italic (Ctrl+I)"
        label="I"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        title="Underline (Ctrl+U)"
        label="U"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <span className="mx-0.5 h-4 w-px bg-[#D6D7D4]" />
      <ToolbarButton
        title="Heading 1"
        label="H1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        title="Heading 2"
        label="H2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        title="Heading 3"
        label="H3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <span className="mx-0.5 h-4 w-px bg-[#D6D7D4]" />
      <ToolbarButton
        title="Bullet list"
        label="• List"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        title="Ordered / nested list"
        label="1. List"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        title="Quote"
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <span className="mx-0.5 h-4 w-px bg-[#D6D7D4]" />
      <label className="flex cursor-pointer items-center gap-1 rounded-[4px] px-1.5 py-1 text-[12px] font-[600] text-[#232A25] hover:bg-[#E8EDE9]">
        Color
        <input
          ref={colorInputRef}
          type="color"
          defaultValue="#232A25"
          onChange={handleColorChange}
          className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
          title="Text color"
        />
      </label>
      <label className="flex cursor-pointer items-center gap-1 rounded-[4px] px-1.5 py-1 text-[12px] font-[600] text-[#232A25] hover:bg-[#E8EDE9]">
        Highlight
        <input
          ref={highlightInputRef}
          type="color"
          defaultValue="#FFE08A"
          onChange={handleHighlightChange}
          className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
          title="Highlight color"
        />
      </label>
      <span className="mx-0.5 h-4 w-px bg-[#D6D7D4]" />
      <ToolbarButton title="Link" label="Link" active={editor.isActive("link")} onClick={insertLink} />
      <ToolbarButton
        title="Insert table"
        label="Table"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      />
      <ToolbarButton
        title="Upload image"
        label="Image"
        disabled={!allowImages}
        onClick={() => onRequestImageUpload?.()}
      />
      <span className="mx-0.5 h-4 w-px bg-[#D6D7D4]" />
      <ToolbarButton title="Inline equation" label="∑" onClick={() => insertMath(false)} />
      <ToolbarButton title="Block equation" label="∑□" onClick={() => insertMath(true)} />
      <ToolbarButton
        title="Geometry placeholder"
        label="Geo"
        onClick={() => editor.chain().focus().insertGeometryPlaceholder().run()}
      />
      <span className="mx-0.5 h-4 w-px bg-[#D6D7D4]" />
      <ToolbarButton title="Undo" label="Undo" onClick={() => editor.chain().focus().undo().run()} />
      <ToolbarButton title="Redo" label="Redo" onClick={() => editor.chain().focus().redo().run()} />
    </div>
  );
};

export default RichTextToolbar;
