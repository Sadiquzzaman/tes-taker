"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Checkbox, Drawer, FileDrop, IconButton, Input, Select, TagInput, Textarea, CloseIcon } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";
import { uploadMedia } from "@/utils/media/uploadMedia";
import { GROUP_TYPES, isCompletion, nextKey, ruleOf } from "./groupTypes";

type OptionRow = { key: string; text: string };
type QuestionRow = { id?: string; prompt: string; options: OptionRow[]; keys: string[]; accepted: string[]; draft: string };

const blankOptions = (): OptionRow[] => ["A", "B", "C", "D"].map((key) => ({ key, text: "" }));
const blankQuestion = (): QuestionRow => ({ prompt: "", options: blankOptions(), keys: [], accepted: [], draft: "" });

const fromGroup = (group: IeltsGroup): QuestionRow[] =>
  group.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt ?? "",
    options: q.options ?? blankOptions(),
    keys: "keys" in q.answer ? q.answer.keys : [],
    accepted: "accepted" in q.answer ? q.answer.accepted : [],
    draft: "",
  }));

/**
 * One question group (IEL-03): its type, instruction, word limit, shared list or word box, text
 * with gaps, picture, and the questions with their answers. The API checks the paper's rules and
 * the 40-number limit; its message is shown as it comes.
 */
const GroupDrawer = ({
  test,
  part,
  group,
  onClose,
  onSaved,
}: {
  test: IeltsTest;
  part: IeltsPart;
  group: IeltsGroup | null;
  onClose: () => void;
  onSaved: (test: IeltsTest) => void;
}) => {
  const t = useTranslations("ieltsBuilder");
  const tt = useTranslations("ieltsTests");
  const { handleError } = useApiError();
  const types = GROUP_TYPES.filter((g) => g.modules.includes(part.module));
  const [type, setType] = useState(group?.type ?? types[0].type);
  const [instruction, setInstruction] = useState(group?.instruction ?? "");
  const [wordLimit, setWordLimit] = useState(group?.word_limit ? String(group.word_limit) : "");
  const [sharedOptions, setSharedOptions] = useState<OptionRow[]>(group?.shared?.options ?? blankOptions());
  const [wordBox, setWordBox] = useState(!!group?.shared?.options && ruleOf(group.type).choices === "text");
  const [sharedText, setSharedText] = useState(group?.shared?.text ?? "");
  const [imageId, setImageId] = useState<string | null>(group?.image_file_id ?? null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>(group ? fromGroup(group) : [blankQuestion()]);
  const [busy, setBusy] = useState(false);

  const rule = ruleOf(type);
  const usesShared = rule.choices === "shared" || (rule.choices === "text" && wordBox);
  const writes = rule.choices === "text" && !wordBox;
  const choicesFor = (q: QuestionRow) =>
    rule.choices === "question" ? q.options.map((o) => o.key) : rule.choices === "fixed" ? (rule.fixed ?? []) : usesShared ? sharedOptions.map((o) => o.key) : [];

  const setQuestion = (index: number, change: Partial<QuestionRow>) => setQuestions(questions.map((q, i) => (i === index ? { ...q, ...change } : q)));

  const upload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(0);
    try {
      const uploaded = await uploadMedia("ielts", file, undefined, { onProgress: setUploading });
      setImageId(uploaded.id);
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    setBusy(true);
    const body = {
      type,
      instruction,
      word_limit: writes && wordLimit ? Number(wordLimit) : null,
      shared:
        usesShared || (isCompletion(type) && sharedText.trim())
          ? { ...(usesShared ? { options: sharedOptions } : {}), ...(isCompletion(type) && sharedText.trim() ? { text: sharedText } : {}) }
          : null,
      image_file_id: imageId,
      questions: questions.map((q) => ({
        ...(q.id ? { id: q.id } : {}),
        prompt: q.prompt.trim() || null,
        options: rule.choices === "question" ? q.options : null,
        answer: writes ? { accepted: q.draft.trim() ? [...q.accepted, q.draft.trim()] : q.accepted } : { keys: q.keys },
      })),
    };
    const base = process.env.NEXT_PUBLIC_BASE_URL;
    try {
      const res = group
        ? await axiosReq.put<{ payload: IeltsTest }>(`${base}/ielts/tests/${test.id}/groups/${group.id}`, body)
        : await axiosReq.post<{ payload: IeltsTest }>(`${base}/ielts/tests/${test.id}/parts/${part.id}/groups`, body);
      onSaved(res.data.payload);
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={group ? t("editGroup") : t("addGroup")}
      description={tt(`partNames.${part.module}`, { no: part.part_no })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Select label={t("groupType")} value={type} onChange={(e) => setType(e.target.value)} options={types.map((g) => ({ value: g.type, label: t(`groupTypes.${g.type}` as "groupTypes.SHORT_ANSWER") }))} />
        <Textarea label={t("instruction")} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={t("instructionHint")} rows={3} />
        {rule.choices === "text" ? (
          <>
            <Checkbox label={t("useWordBox")} checked={wordBox} onChange={() => setWordBox(!wordBox)} />
            {!wordBox ? (
              <Select
                label={t("wordLimit")}
                placeholder={t("noWordLimit")}
                value={wordLimit}
                onChange={(e) => setWordLimit(e.target.value)}
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: t("words", { count: n }) }))}
              />
            ) : null}
          </>
        ) : null}
        {usesShared ? (
          <OptionList legend={rule.choices === "shared" ? t("sharedList") : t("wordBox")} options={sharedOptions} onChange={setSharedOptions} max={26} />
        ) : null}
        {isCompletion(type) ? (
          <Textarea label={t("gapText")} hint={t("gapTextHint", { example: "[[1]], [[2]]…" })} value={sharedText} onChange={(e) => setSharedText(e.target.value)} rows={5} />
        ) : null}
        <div className="flex flex-col gap-2">
          <FileDrop
            label={t("groupPicture")}
            onFiles={(files) => void upload(files)}
            items={imageId ? [{ id: imageId, name: t("pictureAdded") }] : uploading !== null ? [{ id: "uploading", name: t("uploading"), progress: uploading }] : []}
            onRemove={() => setImageId(null)}
            accept="image/jpeg,image/png,image/webp,image/gif"
            acceptLabel={t("imageTypes")}
            maxSizeMb={20}
          />
        </div>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 text-body-sm font-semibold text-ink">{t("questions")}</legend>
          {questions.map((q, i) => {
            const choices = choicesFor(q);
            return (
              <div key={q.id ?? `new-${i}`} className="flex flex-col gap-3 rounded-card border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-body-sm font-medium text-ink">{t("questionN", { n: i + 1 })}</span>
                  <IconButton label={t("removeQuestion", { n: i + 1 })} icon={<CloseIcon />} disabled={questions.length === 1} onClick={() => setQuestions(questions.filter((_, j) => j !== i))} />
                </div>
                <Input label={t("prompt")} value={q.prompt} onChange={(e) => setQuestion(i, { prompt: e.target.value })} />
                {rule.choices === "question" ? <OptionList legend={t("options")} options={q.options} onChange={(options) => setQuestion(i, { options })} max={10} /> : null}
                {writes ? (
                  <TagInput
                    label={t("acceptedAnswers")}
                    hint={t("acceptedHint")}
                    value={q.draft}
                    onChange={(draft) => setQuestion(i, { draft })}
                    tags={q.accepted}
                    onAdd={() => (q.draft.trim() ? setQuestion(i, { accepted: [...q.accepted, q.draft.trim()], draft: "" }) : undefined)}
                    onRemove={(index) => setQuestion(i, { accepted: q.accepted.filter((_, j) => j !== index) })}
                  />
                ) : type === "MCQ_MULTI" ? (
                  <fieldset className="flex flex-wrap gap-3">
                    <legend className="mb-1 text-body-sm text-ink">{t("rightAnswers")}</legend>
                    {choices.map((key) => (
                      <Checkbox
                        key={key}
                        label={key}
                        checked={q.keys.includes(key)}
                        onChange={() => setQuestion(i, { keys: q.keys.includes(key) ? q.keys.filter((k) => k !== key) : [...q.keys, key] })}
                      />
                    ))}
                  </fieldset>
                ) : (
                  <Select
                    label={t("rightAnswer")}
                    placeholder={t("chooseAnswer")}
                    value={q.keys[0] ?? ""}
                    onChange={(e) => setQuestion(i, { keys: e.target.value ? [e.target.value] : [] })}
                    options={choices.map((key) => ({ value: key, label: key }))}
                  />
                )}
              </div>
            );
          })}
          <Button variant="secondary" size="sm" onClick={() => setQuestions([...questions, blankQuestion()])} disabled={questions.length >= 40}>
            {t("addQuestion")}
          </Button>
        </fieldset>
      </div>
    </Drawer>
  );
};

/** Letters and texts: a shared list, a word box, or a question's own options. */
const OptionList = ({ legend, options, onChange, max }: { legend: string; options: OptionRow[]; onChange: (options: OptionRow[]) => void; max: number }) => {
  const t = useTranslations("ieltsBuilder");
  const set = (index: number, change: Partial<OptionRow>) => onChange(options.map((o, i) => (i === index ? { ...o, ...change } : o)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-body-sm text-ink">{legend}</legend>
      {options.map((o, i) => (
        <div key={i} className="flex items-end gap-2">
          <Input label={t("letter")} value={o.key} onChange={(e) => set(i, { key: e.target.value })} fieldClassName="w-20" maxLength={8} />
          <Input label={t("optionText")} value={o.text} onChange={(e) => set(i, { text: e.target.value })} fieldClassName="flex-1" />
          <IconButton label={t("removeOption", { key: o.key || i + 1 })} icon={<CloseIcon />} onClick={() => onChange(options.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button variant="ghost" size="sm" disabled={options.length >= max} onClick={() => onChange([...options, { key: nextKey(options.map((o) => o.key)), text: "" }])}>
        {t("addOption")}
      </Button>
    </fieldset>
  );
};

export default GroupDrawer;
