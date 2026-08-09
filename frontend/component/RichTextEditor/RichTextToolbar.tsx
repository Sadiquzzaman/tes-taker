"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useReducer, type ReactNode } from "react";

type RichTextToolbarProps = {
  editor: Editor | null;
  variant?: "full" | "lite";
  allowImages?: boolean;
  onRequestImageUpload?: () => void;
  onOpenMath?: () => void;
  onOpenGeometry?: () => void;
  onOpenGraph?: () => void;
  onOpenChemistry?: () => void;
};

const IconButton = ({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    disabled={disabled}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className={`rte-tb-btn ${active ? "is-active" : ""}`}
  >
    {children}
  </button>
);

const ToolbarGroup = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="rte-tb-section" data-label={label}>
    <span className="rte-tb-section-label">{label}</span>
    <div className="rte-tb-group">{children}</div>
  </div>
);

const RichTextToolbar = ({
  editor,
  variant = "full",
  allowImages = true,
  onRequestImageUpload,
  onOpenMath,
  onOpenGeometry,
  onOpenGraph,
  onOpenChemistry,
}: RichTextToolbarProps) => {
  const [, forceRender] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const refresh = () => forceRender();
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

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

  if (variant === "lite") {
    return (
      <div className="rte-toolbar rte-toolbar--lite" role="toolbar" aria-label="Instruction formatting">
        <ToolbarGroup label="Formatting">
          <IconButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <strong>B</strong>
          </IconButton>
          <IconButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <em>I</em>
          </IconButton>
          <IconButton
            title="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <span className="underline">U</span>
          </IconButton>
        </ToolbarGroup>
        <ToolbarGroup label="History">
          <IconButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>
            ↶
          </IconButton>
          <IconButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>
            ↷
          </IconButton>
        </ToolbarGroup>
      </div>
    );
  }

  const inTable = editor.isActive("table");

  return (
    <div className="rte-toolbar" role="toolbar" aria-label="Question editor">
      <ToolbarGroup label="Formatting">
        <IconButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </IconButton>
        <IconButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em>I</em>
        </IconButton>
        <IconButton
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </IconButton>
        <IconButton title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="line-through">S</span>
        </IconButton>
        <IconButton
          title="Superscript"
          active={editor.isActive("superscript")}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        >
          X²
        </IconButton>
        <IconButton title="Subscript" active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}>
          X₂
        </IconButton>
      </ToolbarGroup>

      <ToolbarGroup label="Paragraph">
        <select
          className="rte-tb-select"
          aria-label="Text style"
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
                ? "h2"
                : editor.isActive("heading", { level: 3 })
                  ? "h3"
                  : editor.isActive("heading", { level: 4 })
                    ? "h4"
                    : "p"
          }
          onChange={(event) => {
            const value = event.target.value;
            const chain = editor.chain().focus();
            if (value === "p") {
              chain.setParagraph().run();
              return;
            }
            const level = Number(value.replace("h", "")) as 1 | 2 | 3 | 4;
            chain.toggleHeading({ level }).run();
          }}
        >
          <option value="p">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>
        <IconButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          ••
        </IconButton>
        <IconButton
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </IconButton>
        <IconButton
          title="Align left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          ☰
        </IconButton>
        <IconButton
          title="Align center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          ≡
        </IconButton>
        <IconButton
          title="Align right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          ☷
        </IconButton>
      </ToolbarGroup>

      <ToolbarGroup label="Table">
        <IconButton
          title="Insert table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          ▦
        </IconButton>
        <IconButton
          title="Add column before"
          disabled={!inTable || !editor.can().addColumnBefore()}
          onClick={() => editor.chain().focus().addColumnBefore().run()}
        >
          ←Col
        </IconButton>
        <IconButton
          title="Add column after"
          disabled={!inTable || !editor.can().addColumnAfter()}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        >
          Col→
        </IconButton>
        <IconButton
          title="Delete column"
          disabled={!inTable || !editor.can().deleteColumn()}
          onClick={() => editor.chain().focus().deleteColumn().run()}
        >
          Col−
        </IconButton>
        <IconButton
          title="Add row before"
          disabled={!inTable || !editor.can().addRowBefore()}
          onClick={() => editor.chain().focus().addRowBefore().run()}
        >
          ↑Row
        </IconButton>
        <IconButton
          title="Add row after"
          disabled={!inTable || !editor.can().addRowAfter()}
          onClick={() => editor.chain().focus().addRowAfter().run()}
        >
          Row↓
        </IconButton>
        <IconButton
          title="Delete row"
          disabled={!inTable || !editor.can().deleteRow()}
          onClick={() => editor.chain().focus().deleteRow().run()}
        >
          Row−
        </IconButton>
        <IconButton
          title="Toggle header row"
          disabled={!inTable || !editor.can().toggleHeaderRow()}
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        >
          Hdr
        </IconButton>
        <IconButton
          title="Merge cells"
          disabled={!inTable || !editor.can().mergeCells()}
          onClick={() => editor.chain().focus().mergeCells().run()}
        >
          Merge
        </IconButton>
        <IconButton
          title="Split cell"
          disabled={!inTable || !editor.can().splitCell()}
          onClick={() => editor.chain().focus().splitCell().run()}
        >
          Split
        </IconButton>
        <IconButton
          title="Delete table"
          disabled={!inTable || !editor.can().deleteTable()}
          onClick={() => editor.chain().focus().deleteTable().run()}
        >
          ⌫▦
        </IconButton>
      </ToolbarGroup>

      <ToolbarGroup label="Insert">
        <IconButton title="Link" active={editor.isActive("link")} onClick={insertLink}>
          🔗
        </IconButton>
        <IconButton title="Equation" onClick={() => onOpenMath?.()}>
          ∑
        </IconButton>
        <IconButton title="Graph" onClick={() => onOpenGraph?.()}>
          ƒ
        </IconButton>
        <IconButton title="Geometry" onClick={() => onOpenGeometry?.()}>
          △
        </IconButton>
        <IconButton title="Chemistry" onClick={() => onOpenChemistry?.()}>
          ⚗
        </IconButton>
        <IconButton title="Upload image" disabled={!allowImages} onClick={() => onRequestImageUpload?.()}>
          🖼
        </IconButton>
        <IconButton title="Horizontal line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          ―
        </IconButton>
      </ToolbarGroup>

      <ToolbarGroup label="History">
        <IconButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>
          ↶
        </IconButton>
        <IconButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>
          ↷
        </IconButton>
      </ToolbarGroup>
    </div>
  );
};

export default RichTextToolbar;
