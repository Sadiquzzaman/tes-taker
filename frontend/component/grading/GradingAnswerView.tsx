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
    const selectedRightOption = selectedRightOptionId ? rightOptionMap.get(selectedRightOptionId) ?? null : null;
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

const CheckedRadioBox = ({ border, bg, isTick = false, rounded = "full" }: CheckedRadioBoxProps) => {
  return (
    <div
      className={`flex h-4 w-4 items-center justify-center border border-[${border}] bg-[${bg}] rounded-${rounded} text-white`}
    >
      {isTick && <CheckboxTickIcon />}
    </div>
  );
};

const OptionMarker = ({ isCorrect, isSelected, question }: OptionMarkerProps) => {
  const showCheckIcon = isSelected && isCorrect;
  const isCheckbox = question.inputMode === "multi-select";

  if (showCheckIcon && !isCheckbox) return <CheckedRadioBox border="#49734F" bg="#49734F" isTick={true} />;
  if (isCorrect && !isCheckbox) return <CheckedRadioBox border="#49734F" bg="#49734F" />;
  if (isSelected && !isCheckbox) return <CheckedRadioBox border="#D24B44" bg="#D24B44" />;
  if (!isCheckbox) return <CheckedRadioBox border="#232A25" bg="transparent" />;
  if (showCheckIcon && isCheckbox)
    return <CheckedRadioBox border="#49734F" bg="#49734F" isTick={true} rounded="[4px]" />;
  if (isCorrect && isCheckbox) return <CheckedRadioBox border="#49734F" bg="#49734F" rounded="[4px]" />;
  if (isSelected && isCheckbox) return <CheckedRadioBox border="#D24B44" bg="#D24B44" rounded="[4px]" />;
  if (isCheckbox) return <CheckedRadioBox border="#232A25" bg="transparent" rounded="[4px]" />;
};

const GradingAnswerView = ({ question }: GradingModalAnswerViewProps) => {
  if (question.inputMode === "text") {
    return (
      <p className="text-[16px] font-[400] leading-[1.2] tracking-[-0.02em] text-[#747775]">
        {question.textAnswer || "No answer submitted"}
      </p>
    );
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
              className={`flex items-start gap-2 py-1 text-[16px] leading-[16px] tracking-[-0.02em] ${
                isMatched ? "text-[#49734F]" : "text-[#D24B44]"
              }`}
            >
              <span className="min-w-4 text-[#747775]">{index + 1}.</span>
              <span>{leftOption.text}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {pairRows.map(({ leftOption, rightOption, isMatched }, index) => (
            <div
              key={`${leftOption.id}-${rightOption?.id ?? index}`}
              className={`flex items-center gap-2 py-1 text-[16px] leading-[16px] tracking-[-0.02em] ${
                isMatched ? "text-[#49734F]" : "text-[#D24B44]"
              }`}
            >
              <span>{rightOption?.text ?? ""}</span>
              {isMatched ? <CheckedRadioBox border="#49734F" bg="#49734F" isTick={true} /> : null}
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
            <p
              className={`text-[16px] font-[400] leading-[16px] tracking-[-0.02em] ${
                isWrongSelection ? "text-[#D24B44]" : "text-[#232A25]"
              }`}
            >
              {option.text}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default GradingAnswerView;
