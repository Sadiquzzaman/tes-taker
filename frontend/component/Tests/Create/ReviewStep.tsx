import { useAppSelector } from "@/lib/hooks";

const ReviewStep = () => {
  const { formState, subjects } = useAppSelector((state) => state.createTest);
  console.log(formState, subjects);
  const totalQuestions = subjects.reduce((total, subject) => {
    return (
      total +
      subject.questionSections.reduce((sectionTotal, section) => {
        return sectionTotal + section.questions.length;
      }, 0)
    );
  }, 0);
  const totalMarks = subjects.reduce((total, subject) => {
    return (
      total +
      subject.questionSections.reduce((sectionTotal, section) => {
        return (
          sectionTotal +
          section.questions.reduce((questionTotal, question) => {
            return questionTotal + (question.points || 0);
          }, 0)
        );
      }, 0)
    );
  }, 0);
  const divSection = ({ label, value }: { label: string; value: string }) => {
    return (
      <div className="flex">
        <div className="w-[40%]">
          <p className="text-[16px] font-[500] leading-[125%] tracking-[-0.02em] text-[#747775]">{label}</p>
        </div>
        <div className="flex-1">
          <p className="text-[16px] font-[400] leading-[125%] tracking-[-0.02em] text-[#232A25]">{value}</p>
        </div>
      </div>
    );
  };
  return (
    <section className="flex h-full w-full flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[24px] font-[600] leading-6 tracking-[-0.04em] text-[#747775]">Test Summary</h2>
      </div>
      <div className="w-full border-b border-[#E5E5E5]" />
      <div className="flex flex-col gap-3">
        {divSection({ label: "Test name", value: formState.testName })}
        {divSection({ label: "Subject", value: formState.examType !== "model" ? "Model Test" : subjects[0].name })}
        {divSection({ label: "Duration", value: `${formState.duration} minutes` })}
        {divSection({ label: "Total Questions", value: totalQuestions.toString() })}
        {divSection({ label: "Total Marks", value: totalMarks.toString() })}
        {divSection({ label: "Passing Score", value: formState.passingScore })}
        {divSection({
          label: "Negative Score",
          value: formState.negativeMarking ? `${formState.negativeMarking}%` : "N/A",
        })}
      </div>
      <div className="flex items-center justify-between mt-4">
        <h2 className="text-[24px] font-[600] leading-6 tracking-[-0.04em] text-[#747775]">Test Preview</h2>
      </div>
      <div className="w-full border-b border-[#E5E5E5]" />
      <div className="flex-1 w-full h-full rounded-[16px] bg-[#EFF0F3]"></div>
    </section>
  );
};

export default ReviewStep;
