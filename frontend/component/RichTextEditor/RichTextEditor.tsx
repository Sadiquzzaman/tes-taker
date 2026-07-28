"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { normalizeRichTextHtml } from "@/utils/richText";
import { createRichTextExtensions } from "./extensions";
import type { MathOpenDetail } from "./node-views/MathFormulaView";
import GeoGebraModal from "./modals/GeoGebraModal";
import KekuleModal from "./modals/KekuleModal";
import MathLiveModal from "./modals/MathLiveModal";
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

type MathModalState = {
  open: boolean;
  latex: string;
  display: boolean;
  pos: number | null;
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
  const onImageFileRef = useRef(onImageFile);
  const allowImagesRef = useRef(allowImages);
  const [mathModal, setMathModal] = useState<MathModalState>({
    open: false,
    latex: "",
    display: false,
    pos: null,
  });
  const [geometryOpen, setGeometryOpen] = useState(false);
  const [chemistryOpen, setChemistryOpen] = useState(false);

  useEffect(() => {
    onImageFileRef.current = onImageFile;
    allowImagesRef.current = allowImages;
  }, [allowImages, onImageFile]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createRichTextExtensions(placeholder),
    content: value || "",
    editorProps: {
      attributes: {
        class: `rte-content outline-none ${minHeightClassName} ${editorClassName}`.trim(),
        spellcheck: "true",
      },
      handleDOMEvents: {
        focus: () => {
          onFocus?.();
          return false;
        },
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items || !allowImagesRef.current || !onImageFileRef.current) {
          return false;
        }

        const imageFiles: File[] = [];
        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              imageFiles.push(file);
            }
          }
        }

        // Prefer HTML paste from Word/Docs when no image files are present.
        if (!imageFiles.length) {
          return false;
        }

        event.preventDefault();
        void (async () => {
          for (const file of imageFiles) {
            const src = await onImageFileRef.current?.(file);
            if (src) {
              window.dispatchEvent(
                new CustomEvent("rte:insert-image", {
                  detail: { src, kind: "image" },
                }),
              );
            }
          }
        })();
        return true;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length || !allowImagesRef.current || !onImageFileRef.current) {
          return false;
        }

        const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
        if (!imageFiles.length) {
          return false;
        }

        event.preventDefault();
        void (async () => {
          for (const file of imageFiles) {
            const src = await onImageFileRef.current?.(file);
            if (src) {
              window.dispatchEvent(
                new CustomEvent("rte:insert-image", {
                  detail: { src, kind: "image" },
                }),
              );
            }
          }
        })();
        return true;
      },
      transformPastedHTML: (html) => html,
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = normalizeRichTextHtml(currentEditor.getHTML());
      lastEmittedHtml.current = html;
      onChange(html);
    },
  });

  const insertImage = useCallback(
    (src: string, kind: "image" | "geometry" | "chemistry" = "image") => {
      if (!editor) {
        return;
      }
      editor
        .chain()
        .focus()
        .setResizableImage({
          src,
          kind,
          align: "center",
          width: kind === "image" ? "320px" : "420px",
        })
        .run();
    },
    [editor],
  );

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

  useEffect(() => {
    const onOpenMath = (event: Event) => {
      const detail = (event as CustomEvent<MathOpenDetail>).detail;
      if (!detail) {
        return;
      }
      setMathModal({
        open: true,
        latex: detail.latex,
        display: detail.display,
        pos: detail.pos,
      });
    };

    const onInsertImage = (event: Event) => {
      const detail = (event as CustomEvent<{ src: string; kind?: "image" | "geometry" | "chemistry" }>).detail;
      if (!detail?.src) {
        return;
      }
      insertImage(detail.src, detail.kind ?? "image");
    };

    window.addEventListener("rte:open-math", onOpenMath as EventListener);
    window.addEventListener("rte:insert-image", onInsertImage as EventListener);
    return () => {
      window.removeEventListener("rte:open-math", onOpenMath as EventListener);
      window.removeEventListener("rte:insert-image", onInsertImage as EventListener);
    };
  }, [insertImage]);

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = "";
    if (!files?.length || !onImageFile) {
      return;
    }

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        continue;
      }
      const src = await onImageFile(file);
      if (src) {
        insertImage(src, "image");
      }
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!allowImages) {
      return;
    }
    event.preventDefault();
  };

  return (
    <div
      className={`rte-shell overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white ${className}`.trim()}
      onDragOver={handleDragOver}
    >
      <RichTextToolbar
        editor={editor}
        allowImages={allowImages && Boolean(onImageFile)}
        onRequestImageUpload={() => imageInputRef.current?.click()}
        onOpenMath={() => setMathModal({ open: true, latex: "", display: false, pos: null })}
        onOpenGeometry={() => setGeometryOpen(true)}
        onOpenChemistry={() => setChemistryOpen(true)}
      />
      <div className="px-3 py-2">
        <EditorContent editor={editor} />
      </div>
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelected} />

      <MathLiveModal
        open={mathModal.open}
        initialLatex={mathModal.latex}
        initialDisplay={mathModal.display}
        onClose={() => setMathModal((current) => ({ ...current, open: false }))}
        onInsert={({ latex, display }) => {
          if (!editor) {
            return;
          }

          if (typeof mathModal.pos === "number") {
            editor
              .chain()
              .focus()
              .command(({ tr }) => {
                tr.setNodeMarkup(mathModal.pos as number, undefined, { latex, display });
                return true;
              })
              .run();
          } else {
            editor.chain().focus().insertMathFormula({ latex, display }).run();
          }

          setMathModal({ open: false, latex: "", display: false, pos: null });
        }}
      />

      <GeoGebraModal
        open={geometryOpen}
        onClose={() => setGeometryOpen(false)}
        onInsert={(dataUrl) => {
          insertImage(dataUrl, "geometry");
          setGeometryOpen(false);
        }}
      />

      <KekuleModal
        open={chemistryOpen}
        onClose={() => setChemistryOpen(false)}
        onInsert={(dataUrl) => {
          insertImage(dataUrl, "chemistry");
          setChemistryOpen(false);
        }}
      />
    </div>
  );
};

export default RichTextEditor;
