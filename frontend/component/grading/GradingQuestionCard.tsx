import GradedQuestionCard from "./GradedQuestionCard";
import UngradedQuestionCard from "./UngradedQuestionCard";

const GradingQuestionCard = ({ isReadOnly, question }: GradingModalQuestionCardProps) => {
  if (question.isEditable) {
    return <UngradedQuestionCard question={question} isReadOnly={isReadOnly} />;
  }

  return <GradedQuestionCard question={question} />;
};

export default GradingQuestionCard;
