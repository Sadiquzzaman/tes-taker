"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, type ChangeEvent } from "react";
import { normalizeRichTextHtml } from "@/utils/richText";
import { createRichTextExtensions } from "./extensions";
import RichTextToolbar from "./RichTextToolbar";
import "./richTextEditor.css";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  minHeightClassName?: string;
  className?: string;
  editorClassName?: string;
  allowImages?: boolean;
  onImageFile?: (file: File) => Promise<string | null>;
  autoFocus?: boolean;
  editorRef?: (editor: ReturnType<typeof useEditor> | null) => void;
};

const RichTextEditor = ({
  value,
  onChange,
  onFocus,
  placeholder = "Write here...",
  minHeightClassName = "min-h-[72px]",
  className = "",
  editorClassName = "",
  allowImages = true,
  onImageFile,
  autoFocus = false,
  editorRef,
}: RichTextEditorProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastEmittedHtml = useRef(value);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createRichTextExtensions(placeholder),
    content: value || "",
    editorProps: {
      attributes: {
        class: `rte-content outline-none ${minHeightClassName} ${editorClassName}`.trim(),
      },
      handleDOMEvents: {
        focus: () => {
          onFocus?.();
          return false;
        },
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = normalizeRichTextHtml(currentEditor.getHTML());
      lastEmittedHtml.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    editorRef?.(editor);
  }, [editor, editorRef]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const nextValue = value || "";
    if (nextValue === lastEmittedHtml.current) {
      return;
    }

    const current = normalizeRichTextHtml(editor.getHTML());
    if (current === normalizeRichTextHtml(nextValue)) {
      return;
    }

    editor.commands.setContent(nextValue, { emitUpdate: false });
    lastEmittedHtml.current = nextValue;
  }, [editor, value]);

  useEffect(() => {
    if (!editor || !autoFocus) {
      return;
    }

    editor.commands.focus("end");
  }, [autoFocus, editor]);

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !editor || !onImageFile) {
      return;
    }

    const src = await onImageFile(file);
    if (!src) {
      return;
    }

    editor.chain().focus().setImage({ src }).run();
  };

  return (
    <div className={`overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white ${className}`.trim()}>
      <RichTextToolbar
        editor={editor}
        allowImages={allowImages && Boolean(onImageFile)}
        onRequestImageUpload={() => imageInputRef.current?.click()}
      />
      <div className="px-3 py-2">
        <EditorContent editor={editor} />
      </div>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
    </div>
  );
};

export default RichTextEditor;
