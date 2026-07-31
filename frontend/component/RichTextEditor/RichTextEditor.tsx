"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { normalizeRichTextHtml } from "@/utils/richText";
import { parsePastedQuestion, pastedLooksStructured, type ParsedPastedQuestion } from "@/utils/exam/parsePastedQuestion";
import { createRichTextExtensions } from "./extensions";
import type { MathOpenDetail } from "./node-views/MathFormulaView";
import RichTextToolbar from "./RichTextToolbar";
import "./richTextEditor.css";

const MathLiveModal = dynamic(() => import("./modals/MathLiveModal"), { ssr: false });
const GeoGebraModal = dynamic(() => import("./modals/GeoGebraModal"), { ssr: false });
const KekuleModal = dynamic(() => import("./modals/KekuleModal"), { ssr: false });
const ExcalidrawModal = dynamic(() => import("./modals/ExcalidrawModal"), { ssr: false });
const GraphModal = dynamic(() => import("./modals/GraphModal"), { ssr: false });
const OcrModal = dynamic(() => import("./modals/OcrModal"), { ssr: false });

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
  variant?: "full" | "lite";
  enableStructuredPaste?: boolean;
  onStructuredPaste?: (parsed: ParsedPastedQuestion) => void;
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
  variant = "full",
  enableStructuredPaste = false,
  onStructuredPaste,
}: RichTextEditorProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastEmittedHtml = useRef(value);
  const onImageFileRef = useRef(onImageFile);
  const allowImagesRef = useRef(allowImages);
  const enableStructuredPasteRef = useRef(enableStructuredPaste);
  const onStructuredPasteRef = useRef(onStructuredPaste);
  const [mathModal, setMathModal] = useState<MathModalState>({
    open: false,
    latex: "",
    display: false,
    pos: null,
  });
  const [geometryOpen, setGeometryOpen] = useState(false);
  const [chemistryOpen, setChemistryOpen] = useState(false);
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);

  useEffect(() => {
    onImageFileRef.current = onImageFile;
    allowImagesRef.current = allowImages;
    enableStructuredPasteRef.current = enableStructuredPaste;
    onStructuredPasteRef.current = onStructuredPaste;
  }, [allowImages, enableStructuredPaste, onImageFile, onStructuredPaste]);

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
        const clipboard = event.clipboardData;
        if (!clipboard) {
          return false;
        }

        if (enableStructuredPasteRef.current && onStructuredPasteRef.current) {
          const html = clipboard.getData("text/html");
          const plain = clipboard.getData("text/plain");
          const source = html || plain;
          if (source) {
            const parsed = parsePastedQuestion(source);
            if (pastedLooksStructured(parsed)) {
              event.preventDefault();
              onStructuredPasteRef.current(parsed);
              return true;
            }
          }
        }

        const items = clipboard.items;
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
      transformPastedHTML: (html) =>
        html
          .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/<\/?(meta|link|xml|o:p|w:[^>\s]+)[^>]*>/gi, ""),
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = normalizeRichTextHtml(currentEditor.getHTML());
      lastEmittedHtml.current = html;
      onChange(html);
    },
  });

  const insertImage = useCallback(
    (src: string, kind: "image" | "geometry" | "chemistry" | "drawing" | "graph" = "image") => {
      if (!editor) {
        return;
      }
      editor
        .chain()
        .focus()
        .setResizableImage({
          src,
          kind: kind === "drawing" || kind === "graph" ? "geometry" : kind,
          align: "center",
          width: kind === "image" ? "320px" : "480px",
          caption: "",
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

  const isFull = variant === "full";

  return (
    <div
      className={`rte-shell overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white ${className}`.trim()}
      onDragOver={handleDragOver}
    >
      <RichTextToolbar
        editor={editor}
        variant={variant}
        allowImages={allowImages && Boolean(onImageFile)}
        onRequestImageUpload={() => imageInputRef.current?.click()}
        onOpenMath={() => setMathModal({ open: true, latex: "", display: false, pos: null })}
        onOpenDrawing={() => setDrawingOpen(true)}
        onOpenGeometry={() => setGeometryOpen(true)}
        onOpenGraph={() => setGraphOpen(true)}
        onOpenChemistry={() => setChemistryOpen(true)}
        onOpenOcr={() => setOcrOpen(true)}
      />
      <div className="px-3 py-2">
        <EditorContent editor={editor} />
      </div>
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelected} />

      {isFull && mathModal.open ? (
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
      ) : null}

      {isFull && geometryOpen ? (
        <GeoGebraModal
          open={geometryOpen}
          onClose={() => setGeometryOpen(false)}
          onInsert={(dataUrl) => {
            insertImage(dataUrl, "geometry");
            setGeometryOpen(false);
          }}
        />
      ) : null}

      {isFull && chemistryOpen ? (
        <KekuleModal
          open={chemistryOpen}
          onClose={() => setChemistryOpen(false)}
          onInsert={(dataUrl) => {
            insertImage(dataUrl, "chemistry");
            setChemistryOpen(false);
          }}
        />
      ) : null}

      {isFull && drawingOpen ? (
        <ExcalidrawModal
          open={drawingOpen}
          onClose={() => setDrawingOpen(false)}
          onInsert={(dataUrl) => {
            insertImage(dataUrl, "drawing");
            setDrawingOpen(false);
          }}
        />
      ) : null}

      {isFull && graphOpen ? (
        <GraphModal
          open={graphOpen}
          onClose={() => setGraphOpen(false)}
          onInsert={(dataUrl) => {
            insertImage(dataUrl, "graph");
            setGraphOpen(false);
          }}
        />
      ) : null}

      {isFull && ocrOpen ? (
        <OcrModal
          open={ocrOpen}
          onClose={() => setOcrOpen(false)}
          onParsed={(parsed) => {
            onStructuredPaste?.(parsed);
            if (parsed.question && editor && !onStructuredPaste) {
              const html = parsed.question.includes("<") ? parsed.question : `<p>${parsed.question}</p>`;
              editor.commands.setContent(html);
            }
            setOcrOpen(false);
          }}
        />
      ) : null}
    </div>
  );
};

export default RichTextEditor;
