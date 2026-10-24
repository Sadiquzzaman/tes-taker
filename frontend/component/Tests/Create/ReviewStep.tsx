import { RichTextContent } from "@/component/RichTextEditor";
import { getSubjectQuestionCount, getSubjectTotalMarks, isPassageQuestionItem } from "@/lib/features/create-test/createTestDomain";
import { useAppSelector } from "@/lib/hooks";

const ReviewStep = () => {
  const { formState, subjects } = useAppSelector((state) => state.createTest);
  const totalQuestions = subjects.reduce((total, subject) => total + getSubjectQuestionCount(subject), 0);
  const totalMarks = subjects.reduce((total, subject) => total + getSubjectTotalMarks(subject), 0);

  const divSection = ({ label, value }: { label: string; value: string }) => (
    <div className="flex">
      <div className="w-[40%]">
        <p className="text-body font-medium text-ink-muted">{label}</p>
      </div>
      <div className="flex-1">
        <p className="text-body font-normal text-ink">{value}</p>
      </div>
    </div>
  );

  let questionNumber = 1;

  return (
    <section className="flex h-full w-full flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-title font-semibold leading-6 tracking-tight text-ink-muted">Test Summary</h2>
      </div>
      <div className="w-full border-b border-border" />
      <div className="flex flex-col gap-3">
        {divSection({ label: "Test name", value: formState.testName })}
        {divSection({ label: "Subject", value: subjects.map((subject) => subject.name).join(", ") || "N/A" })}
        {divSection({ label: "Duration", value: `${formState.duration} minutes` })}
        {divSection({ label: "Total Questions", value: totalQuestions.toString() })}
        {divSection({ label: "Total Marks", value: totalMarks.toString() })}
        {divSection({ label: "Passing Score", value: formState.passingScore })}
        {divSection({
          label: "Negative Score",
          value: formState.negativeMarking ? `${formState.negativeMarking}%` : "N/A",
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-title font-semibold leading-6 tracking-tight text-ink-muted">Test Preview</h2>
      </div>
      <div className="w-full border-b border-border" />

      <div className="flex flex-col gap-6 rounded-sheet bg-canvas p-4 md:p-6">
        {!subjects.length ? (
          <p className="text-body-sm text-ink-muted">Add questions to preview this exam.</p>
        ) : (
          subjects.map((subject) => (
            <div key={subject.id} className="flex flex-col gap-4 rounded-card bg-surface p-4">
              <h3 className="text-title-sm font-semibold text-ink">{subject.name}</h3>
              {subject.questions.map((question) => {
                if (isPassageQuestionItem(question)) {
                  return (
                    <div key={question.id} className="flex flex-col gap-3 border-t border-border pt-3">
                      <p className="text-body-sm font-semibold uppercase tracking-wide text-ink-muted">Passage</p>
                      <RichTextContent html={question.passageText} />
                      {question.childQuestions.map((child) => {
                        const number = questionNumber;
                        questionNumber += 1;
                        return (
                          <div key={child.id} className="flex flex-col gap-2 rounded-input border border-border p-3">
                            <p className="text-caption font-medium text-ink-muted">
                              {number}. {child.subType} · {child.points} pts
                            </p>
                            {child.instruction ? <RichTextContent html={child.instruction} className="text-body-sm" /> : null}
                            <RichTextContent html={child.text} />
                            {child.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={child.image} alt="" className="max-h-48 rounded-input object-contain" />
                            ) : null}
                            {child.options?.map((option, index) => (
                              <p key={option.id} className="text-body-sm text-ink">
                                {String.fromCharCode(65 + index)}. {option.text}
                              </p>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                const number = questionNumber;
                questionNumber += 1;
                return (
                  <div key={question.id} className="flex flex-col gap-2 border-t border-border pt-3">
                    <p className="text-caption font-medium text-ink-muted">
                      {number}. {question.subType} · {question.points} pts
                    </p>
                    {question.instruction ? <RichTextContent html={question.instruction} className="text-body-sm" /> : null}
                    <RichTextContent html={question.text} />
                    {question.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={question.image} alt="" className="max-h-48 rounded-input object-contain" />
                    ) : null}
                    {question.options?.map((option, index) => (
                      <p key={option.id} className="text-body-sm text-ink">
                        {String.fromCharCode(65 + index)}. {option.text}
                      </p>
                    ))}
                    {question.matchingOptions ? (
                      <div className="grid grid-cols-2 gap-3 text-body-sm">
                        <div>
                          {question.matchingOptions.left.map((option) => (
                            <p key={option.id}>{option.text}</p>
                          ))}
                        </div>
                        <div>
                          {question.matchingOptions.right.map((option) => (
                            <p key={option.id}>{option.text}</p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default ReviewStep;
