"use client";

import type { Editor } from "@tiptap/react";

type ChemistryKeyboardProps = {
  editor: Editor | null;
};

type KeyAction =
  | { type: "mark"; mark: "subscript" | "superscript" }
  | { type: "insert"; text: string }
  | { type: "clearMarks" };

const KEYS: { label: string; title: string; action: KeyAction; wide?: boolean }[] = [
  { label: "Sub", title: "Subscript (for H₂O numbers)", action: { type: "mark", mark: "subscript" } },
  { label: "Sup", title: "Superscript (for charges like ²⁻)", action: { type: "mark", mark: "superscript" } },
  { label: "Aa", title: "Normal text (turn off sub/sup)", action: { type: "clearMarks" } },
  { label: "+", title: "Plus", action: { type: "insert", text: "+" } },
  { label: "−", title: "Minus", action: { type: "insert", text: "−" } },
  { label: "→", title: "Reaction arrow", action: { type: "insert", text: " → " } },
  { label: "⇌", title: "Equilibrium arrow", action: { type: "insert", text: " ⇌ " } },
  { label: "↑", title: "Gas up arrow", action: { type: "insert", text: "↑" } },
  { label: "↓", title: "Precipitate down arrow", action: { type: "insert", text: "↓" } },
  { label: "°", title: "Degree", action: { type: "insert", text: "°" } },
  { label: "·", title: "Dot / hydrate separator", action: { type: "insert", text: "·" } },
  { label: "²⁻", title: "Charge 2−", action: { type: "insert", text: "²⁻" } },
  { label: "³⁺", title: "Charge 3+", action: { type: "insert", text: "³⁺" } },
  { label: "⁺", title: "Positive charge", action: { type: "insert", text: "⁺" } },
  { label: "⁻", title: "Negative charge", action: { type: "insert", text: "⁻" } },
];

const ChemistryKeyboard = ({ editor }: ChemistryKeyboardProps) => {
  if (!editor) {
    return null;
  }

  const run = (action: KeyAction) => {
    if (action.type === "mark") {
      if (action.mark === "subscript") {
        editor.chain().focus().unsetMark("superscript").toggleSubscript().run();
      } else {
        editor.chain().focus().unsetMark("subscript").toggleSuperscript().run();
      }
      return;
    }
    if (action.type === "clearMarks") {
      editor.chain().focus().unsetMark("subscript").unsetMark("superscript").run();
      return;
    }
    editor.chain().focus().unsetMark("subscript").unsetMark("superscript").insertContent(action.text).run();
  };

  const subActive = editor.isActive("subscript");
  const supActive = editor.isActive("superscript");

  return (
    <div className="chem-keyboard" role="toolbar" aria-label="Chemistry symbols">
      <p className="chem-keyboard__hint">
        Tip: tap <strong>Sub</strong>, type a number (like 2 in H₂O), then tap <strong>Aa</strong> for normal text.
      </p>
      <div className="chem-keyboard__grid">
        {KEYS.map((key) => {
          const active =
            key.action.type === "mark" &&
            ((key.action.mark === "subscript" && subActive) || (key.action.mark === "superscript" && supActive));
          return (
            <button
              key={key.label}
              type="button"
              className={`chem-keyboard__key ${active ? "is-active" : ""} ${key.wide ? "is-wide" : ""}`.trim()}
              title={key.title}
              aria-label={key.title}
              aria-pressed={key.action.type === "mark" ? active : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => run(key.action)}
            >
              {key.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChemistryKeyboard;
