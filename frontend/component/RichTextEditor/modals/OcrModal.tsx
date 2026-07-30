"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { parsePastedQuestion, pastedLooksStructured, type ParsedPastedQuestion } from "@/utils/exam/parsePastedQuestion";

type OcrModalProps = {
  open: boolean;
  onClose: () => void;
  onParsed: (parsed: ParsedPastedQuestion, rawText: string) => void;
};

const OcrModalBody = ({ onClose, onParsed }: Omit<OcrModalProps, "open">) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedPastedQuestion | null>(null);

  const runOcr = async (file: File) => {
    setBusy(true);
    setError("");
    setStatus("Loading OCR engine…");
    setParsed(null);
    setRawText("");

    try {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      const { createWorker } = await import("tesseract.js");
      setStatus("Recognizing text…");
      const worker = await createWorker("eng");
      const result = await worker.recognize(file);
      await worker.terminate();

      const text = result.data.text || "";
      setRawText(text);
      const nextParsed = parsePastedQuestion(text);
      setParsed(nextParsed);
      setStatus(pastedLooksStructured(nextParsed) ? "Question structure detected." : "Text extracted. Review before applying.");
    } catch (ocrError) {
      setError(ocrError instanceof Error ? ocrError.message : "OCR failed");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    void runOcr(file);
  };

  return (
    <div className="rte-modal-backdrop" role="dialog" aria-modal="true" aria-label="OCR import">
      <div className="rte-modal rte-modal--wide">
        <div className="rte-modal__header">
          <h3>OCR import</h3>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="rte-modal__hint">
          Upload a photo or scan of a question. Text is extracted with open-source OCR (Tesseract) and parsed with rules —
          no AI.
        </p>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <div className="rte-modal__actions rte-modal__actions--start">
          <button type="button" className="rte-modal__primary" onClick={() => inputRef.current?.click()} disabled={busy}>
            Choose image
          </button>
        </div>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="OCR source" className="rte-ocr-preview" />
        ) : null}
        {status ? <p className="rte-modal__hint">{status}</p> : null}
        {error ? <p className="rte-modal__error">{error}</p> : null}
        {rawText ? (
          <label className="rte-modal__field">
            <span>Extracted text</span>
            <textarea value={rawText} readOnly rows={8} />
          </label>
        ) : null}
        {parsed ? (
          <div className="rte-ocr-summary">
            <p>
              <strong>Question:</strong> {parsed.question || "—"}
            </p>
            <p>
              <strong>Options:</strong> {parsed.options.length ? parsed.options.join(" | ") : "—"}
            </p>
            <p>
              <strong>Correct:</strong>{" "}
              {parsed.correctIndex !== null ? String.fromCharCode(65 + parsed.correctIndex) : "—"}
            </p>
            <p>
              <strong>Explanation:</strong> {parsed.explanation || "—"}
            </p>
          </div>
        ) : null}
        <div className="rte-modal__actions">
          <button type="button" className="rte-modal__secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rte-modal__primary"
            disabled={!parsed || busy}
            onClick={() => {
              if (!parsed) {
                return;
              }
              onParsed(parsed, rawText);
            }}
          >
            Apply to question
          </button>
        </div>
      </div>
    </div>
  );
};

const OcrModal = ({ open, onClose, onParsed }: OcrModalProps) => {
  if (!open) {
    return null;
  }
  return <OcrModalBody key="ocr-session" onClose={onClose} onParsed={onParsed} />;
};

export default OcrModal;
