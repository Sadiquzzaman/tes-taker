"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { ruleOf } from "../groupTypes";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;

export interface PaperGroupProps {
  group: IeltsPaperGroup;
  answers: Record<string, string>;
  onAnswer: (questionId: string, value: string) => void;
  /** Handed in: answers are shown, not changed. */
  readOnly: boolean;
  flagged: Set<string>;
  onFlag: (questionId: string) => void;
}

export const questionAnchor = (number: number) => `ielts-q-${number}`;


/**
 * One question group as on the computer-delivered paper (IEL-04, IEL-05): the instruction, the
 * list to choose from, a picture, the text with gaps filled in place, and each question with its
 * control (choices, a list, or a box to write in) and a flag for review.
 */
const PaperGroup = ({ group, answers, onAnswer, readOnly, flagged, onFlag }: PaperGroupProps) => {
  const t = useTranslations("ieltsTake");
  const format = useFormat();
  const numberLabel = (q: IeltsPaperQuestion) => (q.number_from === q.number_to ? format.number(q.number_from) : `${format.number(q.number_from)}–${format.number(q.number_to)}`);
  const rule = ruleOf(group.type);
  const shared = group.shared?.options ?? [];
  const choicesOf = (q: IeltsPaperQuestion): IeltsOption[] =>
    rule.choices === "question" ? (q.options ?? []) : rule.choices === "fixed" ? (rule.fixed ?? []).map((key) => ({ key, text: key })) : shared;
  const writes = rule.choices === "text" && shared.length === 0;
  const gapText = group.shared?.text;
  const inText = new Set<number>();
  if (gapText) for (const match of gapText.matchAll(/\[\[(\d+)\]\]/g)) inText.add(Number(match[1]));

  const review = (q: IeltsPaperQuestion) =>
    q.key ? (
      <span className={cn("text-body-sm", (q.marks ?? 0) > 0 ? "text-success" : "text-danger")}>
        {(q.marks ?? 0) > 0 ? t("right") : `${t("wrong")} · ${t("rightAnswer", { answer: "keys" in q.key ? q.key.keys.join(", ") : q.key.accepted.join(" / ") })}`}
      </span>
    ) : null;

  // TRUE / FALSE / NOT GIVEN are the paper's own (English) answers, shown as they are.
  /** The control for one question: a box to write in, a list, choices, or "choose N". */
  const control = (q: IeltsPaperQuestion, inline = false): ReactNode => {
    const value = answers[q.id] ?? "";
    const label = t("questionLabel", { number: numberLabel(q) });
    if (writes) {
      return (
        <input
          aria-label={label}
          className={cn("rounded-input border border-border bg-surface px-2 py-1 text-body-sm text-ink", inline ? "mx-1 w-36" : "w-full max-w-sm")}
          value={value}
          disabled={readOnly}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onAnswer(q.id, e.target.value)}
        />
      );
    }
    const choices = choicesOf(q);
    if (rule.choices === "shared" || (rule.choices === "text" && shared.length)) {
      return (
        <select
          aria-label={label}
          className={cn("rounded-input border border-border bg-surface px-2 py-1 text-body-sm text-ink", inline ? "mx-1" : "")}
          value={value}
          disabled={readOnly}
          onChange={(e) => onAnswer(q.id, e.target.value)}
        >
          <option value="">{t("choose")}</option>
          {choices.map((c) => (
            <option key={c.key} value={c.key}>
              {c.key}
            </option>
          ))}
        </select>
      );
    }
    if (group.type === "MCQ_MULTI") {
      const chosen = value ? value.split(",") : [];
      const max = q.number_to - q.number_from + 1;
      return (
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">{label}</legend>
          <span className="text-body-sm text-ink-muted">{t("chooseN", { count: max })}</span>
          {choices.map((c) => (
            <label key={c.key} className="flex items-start gap-2 text-body-sm text-ink">
              <input
                type="checkbox"
                checked={chosen.includes(c.key)}
                disabled={readOnly || (!chosen.includes(c.key) && chosen.length >= max)}
                onChange={() => onAnswer(q.id, (chosen.includes(c.key) ? chosen.filter((k) => k !== c.key) : [...chosen, c.key]).sort().join(","))}
              />
              <span>
                <strong>{c.key}</strong> {c.text}
              </span>
            </label>
          ))}
        </fieldset>
      );
    }
    return (
      <fieldset className="flex flex-col gap-1">
        <legend className="sr-only">{label}</legend>
        {choices.map((c) => (
          <label key={c.key} className="flex items-start gap-2 text-body-sm text-ink">
            <input type="radio" name={`q-${q.id}`} checked={value === c.key} disabled={readOnly} onChange={() => onAnswer(q.id, c.key)} />
            <span>
              {rule.choices === "question" ? <strong>{c.key}</strong> : null} {c.text}
            </span>
          </label>
        ))}
      </fieldset>
    );
  };

  /** The flag for review; inside a sentence (a gap) it is a small ⚑ so the sentence still reads. */
  const flag = (q: IeltsPaperQuestion, inline = false) =>
    readOnly ? null : (
      <button
        type="button"
        className={cn("rounded-input px-2 py-0.5 text-xs", flagged.has(q.id) ? "bg-warning-soft text-warning" : "text-ink-muted hover:bg-canvas")}
        aria-pressed={flagged.has(q.id)}
        aria-label={t("flagLabel", { number: numberLabel(q) })}
        onClick={() => onFlag(q.id)}
      >
        {inline ? "⚑" : flagged.has(q.id) ? t("flagged") : t("flag")}
      </button>
    );

  return (
    <section className="flex flex-col gap-3" aria-label={t("groupLabel", { from: group.number_from ?? 0, to: group.number_to ?? 0 })}>
      <div>
        <h3 className="text-body font-semibold text-ink">{group.number_from === group.number_to ? t("questionLabel", { number: format.number(group.number_from ?? 0) }) : t("groupLabel", { from: group.number_from ?? 0, to: group.number_to ?? 0 })}</h3>
        <p className="whitespace-pre-line text-body-sm text-ink">{group.instruction}</p>
      </div>
      {group.image_file_id ? (
        <Image src={`${BASE}/files/${group.image_file_id}/content`} alt={t("picture")} width={0} height={0} sizes="100vw" unoptimized className="h-auto max-h-80 w-auto self-start rounded-card border border-border" />
      ) : null}
      {shared.length ? (
        <ul className="rounded-card border border-border bg-canvas p-3 text-body-sm text-ink" aria-label={t("listToChoose")}>
          {shared.map((o) => (
            <li key={o.key}>
              <strong className="me-2">{o.key}</strong>
              {o.text}
            </li>
          ))}
        </ul>
      ) : null}
      {gapText ? (
        <p className="whitespace-pre-line text-body-sm leading-8 text-ink">
          {gapText.split(/(\[\[\d+\]\])/).map((piece, i) => {
            const gap = piece.match(/^\[\[(\d+)\]\]$/);
            const q = gap ? group.questions[Number(gap[1]) - 1] : undefined;
            if (!gap) return <span key={i}>{piece}</span>;
            if (!q) return <span key={i}>____</span>;
            return (
              <span key={i} id={questionAnchor(q.number_from)} className="inline-flex items-center">
                <strong className="text-xs">{format.number(q.number_from)}</strong>
                {control(q, true)}
                {flag(q, true)}
              </span>
            );
          })}
        </p>
      ) : null}
      <ol className="flex flex-col gap-4">
        {group.questions.map((q, i) =>
          inText.has(i + 1) ? (
            q.key ? (
              <li key={q.id} className="text-body-sm">
                <strong>{numberLabel(q)}.</strong> {answers[q.id] ?? "—"} · {review(q)}
              </li>
            ) : null
          ) : (
            <li key={q.id} id={questionAnchor(q.number_from)} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-body-sm text-ink">
                  <strong className="me-2">{numberLabel(q)}</strong>
                  {q.prompt}
                </p>
                {flag(q)}
              </div>
              {control(q)}
              {review(q)}
            </li>
          ),
        )}
      </ol>
    </section>
  );
};

export default PaperGroup;
