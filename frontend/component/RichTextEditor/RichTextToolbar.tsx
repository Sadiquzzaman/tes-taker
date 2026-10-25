"use client";

import type { Editor } from "@tiptap/react";
import { useTranslations } from "next-intl";
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
    aria-pressed={active === undefined ? undefined : active}
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
  const t = useTranslations("editor.toolbar");
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
    const url = window.prompt(t("linkPrompt"), previous ?? "https://");
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
      <div className="rte-toolbar rte-toolbar--lite" role="toolbar" aria-label={t("liteLabel")}>
        <ToolbarGroup label={t("formatting")}>
          <IconButton title={t("bold")} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <strong>B</strong>
          </IconButton>
          <IconButton title={t("italic")} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <em>I</em>
          </IconButton>
          <IconButton
            title={t("underline")}
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <span className="underline">U</span>
          </IconButton>
        </ToolbarGroup>
        <ToolbarGroup label={t("history")}>
          <IconButton title={t("undo")} onClick={() => editor.chain().focus().undo().run()}>
            ↶
          </IconButton>
          <IconButton title={t("redo")} onClick={() => editor.chain().focus().redo().run()}>
            ↷
          </IconButton>
        </ToolbarGroup>
      </div>
    );
  }

  const inTable = editor.isActive("table");

  return (
    <div className="rte-toolbar" role="toolbar" aria-label={t("fullLabel")}>
      <ToolbarGroup label={t("formatting")}>
        <IconButton title={t("bold")} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </IconButton>
        <IconButton title={t("italic")} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em>I</em>
        </IconButton>
        <IconButton
          title={t("underline")}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </IconButton>
        <IconButton title={t("strike")} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="line-through">S</span>
        </IconButton>
        <IconButton
          title={t("superscript")}
          active={editor.isActive("superscript")}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        >
          X²
        </IconButton>
        <IconButton title={t("subscript")} active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}>
          X₂
        </IconButton>
      </ToolbarGroup>

      <ToolbarGroup label={t("paragraph")}>
        <select
          className="rte-tb-select"
          aria-label={t("textStyle")}
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
          <option value="p">{t("normal")}</option>
          <option value="h1">{t("heading", { level: 1 })}</option>
          <option value="h2">{t("heading", { level: 2 })}</option>
          <option value="h3">{t("heading", { level: 3 })}</option>
          <option value="h4">{t("heading", { level: 4 })}</option>
        </select>
        <IconButton
          title={t("bulletList")}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          ••
        </IconButton>
        <IconButton
          title={t("numberedList")}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </IconButton>
        <IconButton
          title={t("alignLeft")}
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          ☰
        </IconButton>
        <IconButton
          title={t("alignCenter")}
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          ≡
        </IconButton>
        <IconButton
          title={t("alignRight")}
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          ☷
        </IconButton>
      </ToolbarGroup>

      <ToolbarGroup label={t("table")}>
        <IconButton
          title={t("insertTable")}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          ▦
        </IconButton>
        <IconButton
          title={t("addColumnBefore")}
          disabled={!inTable || !editor.can().addColumnBefore()}
          onClick={() => editor.chain().focus().addColumnBefore().run()}
        >
          ←Col
        </IconButton>
        <IconButton
          title={t("addColumnAfter")}
          disabled={!inTable || !editor.can().addColumnAfter()}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        >
          Col→
        </IconButton>
        <IconButton
          title={t("deleteColumn")}
          disabled={!inTable || !editor.can().deleteColumn()}
          onClick={() => editor.chain().focus().deleteColumn().run()}
        >
          Col−
        </IconButton>
        <IconButton
          title={t("addRowBefore")}
          disabled={!inTable || !editor.can().addRowBefore()}
          onClick={() => editor.chain().focus().addRowBefore().run()}
        >
          ↑Row
        </IconButton>
        <IconButton
          title={t("addRowAfter")}
          disabled={!inTable || !editor.can().addRowAfter()}
          onClick={() => editor.chain().focus().addRowAfter().run()}
        >
          Row↓
        </IconButton>
        <IconButton
          title={t("deleteRow")}
          disabled={!inTable || !editor.can().deleteRow()}
          onClick={() => editor.chain().focus().deleteRow().run()}
        >
          Row−
        </IconButton>
        <IconButton
          title={t("toggleHeaderRow")}
          disabled={!inTable || !editor.can().toggleHeaderRow()}
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        >
          Hdr
        </IconButton>
        <IconButton
          title={t("mergeCells")}
          disabled={!inTable || !editor.can().mergeCells()}
          onClick={() => editor.chain().focus().mergeCells().run()}
        >
          Merge
        </IconButton>
        <IconButton
          title={t("splitCell")}
          disabled={!inTable || !editor.can().splitCell()}
          onClick={() => editor.chain().focus().splitCell().run()}
        >
          Split
        </IconButton>
        <IconButton
          title={t("deleteTable")}
          disabled={!inTable || !editor.can().deleteTable()}
          onClick={() => editor.chain().focus().deleteTable().run()}
        >
          ⌫▦
        </IconButton>
      </ToolbarGroup>

      <ToolbarGroup label={t("insert")}>
        <IconButton title={t("link")} active={editor.isActive("link")} onClick={insertLink}>
          🔗
        </IconButton>
        <IconButton title={t("equation")} onClick={() => onOpenMath?.()}>
          ∑
        </IconButton>
        <IconButton title={t("graph")} onClick={() => onOpenGraph?.()}>
          ƒ
        </IconButton>
        <IconButton title={t("geometry")} onClick={() => onOpenGeometry?.()}>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>△</span>
            <span className="text-caption font-medium leading-none">{t("geometryShort")}</span>
          </span>
        </IconButton>
        <IconButton title={t("chemistry")} onClick={() => onOpenChemistry?.()}>
          ⚗
        </IconButton>
        <IconButton title={t("image")} disabled={!allowImages} onClick={() => onRequestImageUpload?.()}>
          🖼
        </IconButton>
        <IconButton title={t("horizontalLine")} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          ―
        </IconButton>
      </ToolbarGroup>

      <ToolbarGroup label={t("history")}>
        <IconButton title={t("undo")} onClick={() => editor.chain().focus().undo().run()}>
          ↶
        </IconButton>
        <IconButton title={t("redo")} onClick={() => editor.chain().focus().redo().run()}>
          ↷
        </IconButton>
      </ToolbarGroup>
    </div>
  );
};

export default RichTextToolbar;
