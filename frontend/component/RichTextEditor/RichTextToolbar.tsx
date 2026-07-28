"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useReducer, type ReactNode } from "react";

type RichTextToolbarProps = {
  editor: Editor | null;
  allowImages?: boolean;
  onRequestImageUpload?: () => void;
  onOpenMath?: () => void;
  onOpenGeometry?: () => void;
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

const Divider = () => <span className="rte-tb-divider" />;

const RichTextToolbar = ({
  editor,
  allowImages = true,
  onRequestImageUpload,
  onOpenMath,
  onOpenGeometry,
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

  return (
    <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
      <div className="rte-tb-group">
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
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>
      </div>

      <Divider />

      <div className="rte-tb-group">
        <IconButton title="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </IconButton>
        <IconButton title="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em>I</em>
        </IconButton>
        <IconButton
          title="Underline (Ctrl+U)"
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
      </div>

      <Divider />

      <div className="rte-tb-group">
        <label className="rte-tb-color" title="Text color">
          <span>A</span>
          <input
            type="color"
            defaultValue="#232A25"
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          />
        </label>
        <label className="rte-tb-color" title="Highlight / background">
          <span>🖍</span>
          <input
            type="color"
            defaultValue="#FFE08A"
            onChange={(event) => editor.chain().focus().toggleHighlight({ color: event.target.value }).run()}
          />
        </label>
      </div>

      <Divider />

      <div className="rte-tb-group">
        <IconButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          ••
        </IconButton>
        <IconButton
          title="Ordered / nested list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </IconButton>
        <IconButton title="Task list" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          ☑
        </IconButton>
        <IconButton
          title="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          ❝
        </IconButton>
        <IconButton title="Horizontal line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          ―
        </IconButton>
      </div>

      <Divider />

      <div className="rte-tb-group">
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
        <IconButton
          title="Justify"
          active={editor.isActive({ textAlign: "justify" })}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          ≣
        </IconButton>
      </div>

      <Divider />

      <div className="rte-tb-group">
        <IconButton title="Link" active={editor.isActive("link")} onClick={insertLink}>
          🔗
        </IconButton>
        <IconButton
          title="Insert table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          ▦
        </IconButton>
        <IconButton title="Add column" disabled={!editor.can().addColumnAfter()} onClick={() => editor.chain().focus().addColumnAfter().run()}>
          Col+
        </IconButton>
        <IconButton title="Add row" disabled={!editor.can().addRowAfter()} onClick={() => editor.chain().focus().addRowAfter().run()}>
          Row+
        </IconButton>
        <IconButton title="Merge cells" disabled={!editor.can().mergeCells()} onClick={() => editor.chain().focus().mergeCells().run()}>
          Merge
        </IconButton>
        <IconButton title="Split cell" disabled={!editor.can().splitCell()} onClick={() => editor.chain().focus().splitCell().run()}>
          Split
        </IconButton>
        <IconButton title="Delete table" disabled={!editor.can().deleteTable()} onClick={() => editor.chain().focus().deleteTable().run()}>
          ⌫▦
        </IconButton>
        <IconButton title="Upload image" disabled={!allowImages} onClick={() => onRequestImageUpload?.()}>
          🖼
        </IconButton>
      </div>

      <Divider />

      <div className="rte-tb-group">
        <IconButton title="Equation (MathLive)" onClick={() => onOpenMath?.()}>
          ∑
        </IconButton>
        <IconButton title="Geometry (GeoGebra)" onClick={() => onOpenGeometry?.()}>
          △
        </IconButton>
        <IconButton title="Chemistry (Kekule)" onClick={() => onOpenChemistry?.()}>
          ⚗
        </IconButton>
      </div>

      <Divider />

      <div className="rte-tb-group">
        <IconButton title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>
          ↶
        </IconButton>
        <IconButton title="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()}>
          ↷
        </IconButton>
      </div>
    </div>
  );
};

export default RichTextToolbar;
