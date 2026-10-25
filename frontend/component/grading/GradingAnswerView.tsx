import { useTranslations } from "next-intl";
import { cn } from "@/design/ui";
const CheckboxTickIcon = () => {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.16665 2.91675L3.58331 7.50008L1.49998 5.41675"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const getOrderedMatchingAnswers = (question: GradingModalQuestion): GradingModalMatchingOption[] => {
  const matchingOptions = question.matchingOptions;

  if (!matchingOptions) {
    return [];
  }

  const rightOptionMap = new Map(matchingOptions.right.map((option) => [option.id, option]));
  const orderedRightOptions = question.selectedAnswerValues
    .map((pair) => pair.split("::")[1])
    .map((rightOptionId) => rightOptionMap.get(rightOptionId) ?? null)
    .filter((option): option is GradingModalMatchingOption => Boolean(option));

  return orderedRightOptions.length === matchingOptions.right.length ? orderedRightOptions : matchingOptions.right;
};

const getMatchingPairRows = (question: GradingModalQuestion) => {
  const matchingOptions = question.matchingOptions;

  if (!matchingOptions) {
    return [];
  }

  const fallbackRightOptions = getOrderedMatchingAnswers(question);
  const rightOptionMap = new Map(matchingOptions.right.map((option) => [option.id, option]));
  const correctAnswerSet = new Set(question.correctAnswerValues);
  const selectedPairMap = new Map<string, string>();

  question.selectedAnswerValues.forEach((pair) => {
    const [leftOptionId, rightOptionId] = pair.split("::");

    if (!leftOptionId || !rightOptionId) {
      return;
    }

    selectedPairMap.set(leftOptionId, rightOptionId);
  });

  return matchingOptions.left.map((leftOption, index) => {
    const selectedRightOptionId = selectedPairMap.get(leftOption.id);
    const selectedRightOption = selectedRightOptionId ? (rightOptionMap.get(selectedRightOptionId) ?? null) : null;
    const fallbackRightOption = fallbackRightOptions[index] ?? null;
    const rightOption = selectedRightOption ?? fallbackRightOption;
    const pairValue = selectedRightOptionId ? `${leftOption.id}::${selectedRightOptionId}` : null;

    return {
      leftOption,
      rightOption,
      isMatched: pairValue ? correctAnswerSet.has(pairValue) : false,
    };
  });
};

type MarkerTone = "correct" | "wrong" | "neutral";

/** A radio-style (round) or checkbox-style (square) mark, coloured by whether the choice was right. */
const ChoiceMarker = ({ tone, ticked = false, square = false }: { tone: MarkerTone; ticked?: boolean; square?: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "flex size-4 shrink-0 items-center justify-center border text-ink-inverse",
      square ? "rounded-sm" : "rounded-full",
      tone === "correct" && "border-primary bg-primary",
      tone === "wrong" && "border-danger bg-danger",
      tone === "neutral" && "border-ink bg-transparent",
    )}
  >
    {ticked ? <CheckboxTickIcon /> : null}
  </span>
);

const OptionMarker = ({ isCorrect, isSelected, question }: OptionMarkerProps) => {
  const square = question.inputMode === "multi-select";
  const tone: MarkerTone = isCorrect ? "correct" : isSelected ? "wrong" : "neutral";
  return <ChoiceMarker tone={tone} ticked={isSelected && isCorrect} square={square} />;
};

/** What the student answered: text, matched pairs, or options marked right and wrong. */
const GradingAnswerView = ({ question }: GradingModalAnswerViewProps) => {
  const t = useTranslations("grading.answer");

  if (question.inputMode === "text") {
    return <p className="whitespace-pre-wrap text-body text-ink">{question.textAnswer || <span className="text-ink-muted">{t("none")}</span>}</p>;
  }

  if (question.inputMode === "matching") {
    const matchingOptions = question.matchingOptions;
    const pairRows = getMatchingPairRows(question);

    if (!matchingOptions) {
      return null;
    }

    return (
      <div className="grid gap-x-4 gap-y-2 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          {pairRows.map(({ leftOption, isMatched }, index) => (
            <div
              key={leftOption.id}
              className={`flex items-start gap-2 py-1 text-body ${
                isMatched ? "text-primary" : "text-danger"
              }`}
            >
              <span className="min-w-4 text-ink-muted">{index + 1}.</span>
              <span>{leftOption.text}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {pairRows.map(({ leftOption, rightOption, isMatched }, index) => (
            <div
              key={`${leftOption.id}-${rightOption?.id ?? index}`}
              className={`flex items-center gap-2 py-1 text-body ${
                isMatched ? "text-primary" : "text-danger"
              }`}
            >
              <span>{rightOption?.text ?? ""}</span>
              {isMatched ? <ChoiceMarker tone="correct" ticked /> : null}
              <span className="sr-only">{isMatched ? t("matched") : t("notMatched")}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {question.options.map((option) => {
        const isSelected = question.selectedAnswerValues.includes(option.id);
        const isCorrect = question.correctAnswerValues.includes(option.id);
        const isWrongSelection = isSelected && !isCorrect;

        return (
          <div key={option.id} className="flex items-center gap-2 py-1">
            <OptionMarker question={question} isSelected={isSelected} isCorrect={isCorrect} />
            <p className={cn("text-body", isWrongSelection ? "text-danger" : "text-ink")}>
              {option.text}
              {isSelected || isCorrect ? (
                <span className="sr-only">
                  {" "}
                  ({isSelected ? (isCorrect ? t("chosenCorrect") : t("chosenWrong")) : t("correctOption")})
                </span>
              ) : null}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default GradingAnswerView;
