"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { RichTextContent } from "@/component/RichTextEditor";
import { Card } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { getSubjectQuestionCount, getSubjectTotalMarks, isPassageQuestionItem } from "@/lib/features/create-test/createTestDomain";
import { useAppSelector } from "@/lib/hooks";
import useQuestionTypeText from "./useQuestionTypeText";

/** One question as students will see it. */
const QuestionPreview = ({ question, number }: { question: QuestionItem; number: number }) => {
  const t = useTranslations("createTest.review");
  const typeText = useQuestionTypeText();

  return (
    <div className="flex flex-col gap-2 rounded-input border border-border p-3">
      <p className="text-caption font-medium text-ink-muted">
        {t("questionMeta", { number, type: typeText.type(question.type, question.subType, question.subType), points: question.points })}
      </p>
      {question.instruction ? <RichTextContent html={question.instruction} className="text-body-sm" /> : null}
      <RichTextContent html={question.text} />
      {question.image ? (
        <Image src={question.image} alt="" width={0} height={0} sizes="100vw" unoptimized className="h-auto max-h-48 w-auto rounded-input object-contain" />
      ) : null}
      {question.options?.length ? (
        <ol className="flex flex-col gap-1 text-body-sm text-ink">
          {question.options.map((option, index) => (
            <li key={option.id}>
              {String.fromCharCode(65 + index)}. {option.text}
            </li>
          ))}
        </ol>
      ) : null}
      {question.matchingOptions ? (
        <div className="grid grid-cols-2 gap-3 text-body-sm">
          <ul>
            {question.matchingOptions.left.map((option) => (
              <li key={option.id}>{option.text}</li>
            ))}
          </ul>
          <ul>
            {question.matchingOptions.right.map((option) => (
              <li key={option.id}>{option.text}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

/** Step 3: the test's settings at a glance, then a read-only preview of every question. */
const ReviewStep = () => {
  const t = useTranslations("createTest.review");
  const format = useFormat();
  const { formState, subjects } = useAppSelector((state) => state.createTest);
  const totalQuestions = subjects.reduce((total, subject) => total + getSubjectQuestionCount(subject), 0);
  const totalMarks = subjects.reduce((total, subject) => total + getSubjectTotalMarks(subject), 0);

  const facts = [
    { key: "name", label: t("name"), value: formState.testName || "—" },
    { key: "subjects", label: t("subjects"), value: subjects.map((subject) => subject.name).join(", ") || "—" },
    { key: "duration", label: t("duration"), value: t("minutes", { minutes: Number(formState.duration) || 0 }) },
    { key: "questions", label: t("questions"), value: format.number(totalQuestions) },
    { key: "marks", label: t("marks"), value: format.number(totalMarks) },
    { key: "passing", label: t("passing"), value: formState.passingScore ? format.number(Number(formState.passingScore)) : t("none") },
    { key: "negative", label: t("negative"), value: formState.negativeMarking ? `${format.number(Number(formState.negativeMarking))}%` : t("none") },
  ];

  // Number questions in order across subjects and passages.
  const numbers = new Map<string, number>();
  for (const subject of subjects) {
    for (const question of subject.questions) {
      for (const item of isPassageQuestionItem(question) ? question.childQuestions : [question]) {
        numbers.set(item.id, numbers.size + 1);
      }
    }
  }

  return (
    <section className="flex w-full flex-1 flex-col gap-6">
      <Card title={t("summary")}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.key} className="flex flex-col gap-0.5">
              <dt className="text-body-sm text-ink-muted">{fact.label}</dt>
              <dd className="text-body font-medium text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title={t("preview")}>
        {!subjects.length ? (
          <p className="text-body-sm text-ink-muted">{t("empty")}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {subjects.map((subject) => (
              <section key={subject.id} className="flex flex-col gap-3">
                <h3 className="text-body font-semibold text-ink">{subject.name}</h3>
                {subject.questions.map((question) => {
                  if (isPassageQuestionItem(question)) {
                    return (
                      <div key={question.id} className="flex flex-col gap-3 rounded-input bg-canvas p-3">
                        <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">{t("passage")}</p>
                        <RichTextContent html={question.passageText} />
                        {question.childQuestions.map((child) => (
                          <QuestionPreview key={child.id} question={child} number={numbers.get(child.id) ?? 0} />
                        ))}
                      </div>
                    );
                  }
                  return <QuestionPreview key={question.id} question={question} number={numbers.get(question.id) ?? 0} />;
                })}
              </section>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
};

export default ReviewStep;
