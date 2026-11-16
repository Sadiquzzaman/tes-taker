"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { RichTextContent } from "@/component/RichTextEditor";
import { cn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;

/** Words Task 1 and Task 2 ask for; fewer is shown, not blocked (IEL-06). */
export const MIN_WORDS: Record<number, number> = { 1: 150, 2: 250 };

/** Words in a script, numbers included, as the real test counts them. */
export const essayWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/**
 * A Writing task as on the computer-delivered test (IEL-06): the task (and its chart or diagram)
 * on the left, the answer box on the right with a live word count; fewer words than asked is
 * shown, not blocked.
 */
const WritingTask = ({ part, value, onChange, readOnly = false }: { part: IeltsPaperPart; value: string; onChange: (value: string) => void; readOnly?: boolean }) => {
  const t = useTranslations("ieltsTake");
  const format = useFormat();
  const words = essayWords(value);
  const min = MIN_WORDS[part.part_no] ?? 0;
  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-2">
      <section aria-label={t("task")} className="flex flex-col gap-4 overflow-y-auto border-border p-4 md:border-e">
        {part.title ? <h2 className="text-title-sm font-semibold text-ink">{part.title}</h2> : null}
        <RichTextContent html={part.content ?? ""} />
        {part.image_file_id ? (
          <Image src={`${BASE}/files/${part.image_file_id}/content`} alt={t("picture")} width={0} height={0} sizes="100vw" unoptimized className="h-auto max-h-96 w-auto self-start rounded-card border border-border" />
        ) : null}
      </section>
      <section aria-label={t("yourAnswer")} className="flex min-h-0 flex-col gap-2 p-4">
        <textarea
          aria-label={t("answerFor", { no: part.part_no })}
          className="min-h-[50vh] flex-1 resize-none rounded-input border border-border bg-surface p-3 text-body text-ink"
          value={value}
          readOnly={readOnly}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          onChange={(e) => onChange(e.target.value)}
        />
        <p className={cn("text-body-sm", words < min ? "text-warning" : "text-ink-muted")} aria-live="polite">
          {t("wordCount", { count: words })}
          {words < min ? ` · ${t("underMinimum", { count: min })}` : ""}
        </p>
        <span className="sr-only">{format.number(words)}</span>
      </section>
    </div>
  );
};

export default WritingTask;
