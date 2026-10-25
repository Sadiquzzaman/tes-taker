"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import "mathlive";
import "mathlive/static.css";

type MathLiveModalProps = {
  open: boolean;
  initialLatex?: string;
  initialDisplay?: boolean;
  onClose: () => void;
  onInsert: (payload: { latex: string; display: boolean }) => void;
};

const MathLiveModalBody = ({
  initialLatex,
  initialDisplay,
  onClose,
  onInsert,
}: Omit<MathLiveModalProps, "open">) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLElement | null>(null);
  const displayRef = useRef(Boolean(initialDisplay));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    host.innerHTML = "";
    const field = document.createElement("math-field") as HTMLElement & {
      value: string;
      smartMode?: boolean;
    };
    field.className = "rte-mathlive-field";
    field.setAttribute("virtual-keyboard-mode", "manual");
    field.value = initialLatex || "";
    field.smartMode = true;
    field.style.width = "100%";
    field.style.minHeight = "64px";
    field.style.fontSize = "22px";
    host.appendChild(field);
    fieldRef.current = field;

    requestAnimationFrame(() => {
      field.focus?.();
    });

    return () => {
      fieldRef.current = null;
      host.innerHTML = "";
    };
  }, [initialLatex]);

  const t = useTranslations("editor.math");
  const tUi = useTranslations("ui");

  const handleInsert = () => {
    const field = fieldRef.current as (HTMLElement & { value?: string; getValue?: (format: string) => string }) | null;
    const latex = field?.getValue?.("latex") ?? field?.value ?? "";
    const trimmed = String(latex).trim();
    if (!trimmed) {
      return;
    }
    onInsert({ latex: trimmed, display: displayRef.current });
  };

  return (
    <div className="rte-modal-backdrop" role="dialog" aria-modal="true" aria-label={t("label")}>
      <div className="rte-modal">
        <div className="rte-modal__header">
          <h3>{t("title")}</h3>
          <button type="button" className="rte-modal__close" onClick={onClose} aria-label={tUi("close")}>
            ×
          </button>
        </div>
        <p className="rte-modal__hint">
          {t("hint")}
        </p>
        <div ref={hostRef} className="rte-mathlive-host" />
        <div className="rte-modal__row">
          <label className="rte-modal__check">
            <input
              type="checkbox"
              defaultChecked={Boolean(initialDisplay)}
              onChange={(event) => {
                displayRef.current = event.target.checked;
              }}
            />
            {t("block")}
          </label>
          <button type="button" className="rte-modal__ghost" onClick={() => window.mathVirtualKeyboard?.show()}>
            {t("keyboard")}
          </button>
        </div>
        <div className="rte-modal__actions">
          <button type="button" className="rte-modal__ghost" onClick={onClose}>
            {tUi("cancel")}
          </button>
          <button type="button" className="rte-modal__primary" onClick={handleInsert}>
            {t("insert")}
          </button>
        </div>
      </div>
    </div>
  );
};

const MathLiveModal = ({ open, initialLatex = "", initialDisplay = false, onClose, onInsert }: MathLiveModalProps) => {
  if (!open) {
    return null;
  }

  return (
    <MathLiveModalBody
      key={`${initialLatex}:${initialDisplay}`}
      initialLatex={initialLatex}
      initialDisplay={initialDisplay}
      onClose={onClose}
      onInsert={onInsert}
    />
  );
};

export default MathLiveModal;
