import GradedQuestionCard from "./GradedQuestionCard";
import UngradedQuestionCard from "./UngradedQuestionCard";

const GradingQuestionCard = ({
  draft,
  isReadOnly,
  onExplanationChange,
  onScoreBlur,
  onScoreChange,
  question,
}: GradingModalQuestionCardProps) => {
  if (question.isEditable) {
    return (
      <UngradedQuestionCard
        question={question}
        draft={draft}
        isReadOnly={isReadOnly}
        onExplanationChange={onExplanationChange}
        onScoreBlur={onScoreBlur}
        onScoreChange={onScoreChange}
      />
    );
  }

  return <GradedQuestionCard question={question} />;
};

export default GradingQuestionCard;
