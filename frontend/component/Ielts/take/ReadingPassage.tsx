"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { RichTextContent } from "@/component/RichTextEditor";
import { Button, Textarea } from "@/design/ui";
import { useStorageItem } from "@/hooks/useBrowserStorage";

const notesKey = (attemptId: string, partId: string) => `ielts-notes:${attemptId}:${partId}`;

/**
 * A Reading passage as on the computer-delivered test (IEL-05): select text to highlight it, clear
 * highlights, and keep notes beside it. Highlights stay while the page is open; notes are kept on
 * this device for the attempt.
 */
const ReadingPassage = ({ attemptId, part }: { attemptId: string; part: IeltsPaperPart }) => {
  const t = useTranslations("ieltsTake");
  const box = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<Range | null>(null);
  const key = notesKey(attemptId, part.id);
  const stored = useStorageItem("session", key);
  const [draft, setNotes] = useState<string | null>(null);
  const notes = draft ?? stored ?? "";

  const keepNotes = (value: string) => {
    setNotes(value);
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Notes still show on this page without storage.
    }
  };

  const select = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount || !box.current?.contains(selection.anchorNode)) {
      setRange(null);
      return;
    }
    setRange(selection.getRangeAt(0).cloneRange());
  };

  const highlight = () => {
    if (!range) return;
    const mark = document.createElement("mark");
    mark.className = "rounded-sm bg-warning-soft text-ink";
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
    window.getSelection()?.removeAllRanges();
    setRange(null);
  };

  const clear = () => {
    box.current?.querySelectorAll("mark").forEach((mark) => mark.replaceWith(...Array.from(mark.childNodes)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={!range} onMouseDown={(e) => e.preventDefault()} onClick={highlight}>
          {t("highlight")}
        </Button>
        <Button size="sm" variant="ghost" onClick={clear}>
          {t("clearHighlights")}
        </Button>
      </div>
      {part.title ? <h2 className="text-title-sm font-semibold text-ink">{part.title}</h2> : null}
      <div ref={box} onMouseUp={select} onKeyUp={select} data-testid="passage">
        <RichTextContent html={part.content ?? ""} />
      </div>
      <Textarea label={t("notes")} hint={t("notesHint")} value={notes} onChange={(e) => keepNotes(e.target.value)} rows={4} />
    </div>
  );
};

export default ReadingPassage;
