import { useAppSelector } from "@/lib/hooks";
import ParticipantIconSVG from "../svg/ParticipantIconSVG";

const GradeDetailsStats = () => {
  const gradeStats = useAppSelector((state) => state.gradeDetails.stats);
  const statList = [
    { label: "Total students", value: gradeStats?.total_students ?? 0 },
    { label: "Submissions", value: gradeStats?.submissions ?? 0 },
    { label: "Pending", value: gradeStats?.pending ?? 0 },
    { label: "Graded", value: gradeStats?.graded ?? 0 },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      {statList.map((stat) => (
        <div key={stat.label} className="flex flex-1 gap-4 rounded-[12px] bg-[#EFF0F3BF] p-4">
          <ParticipantIconSVG />
          <div className="flex flex-col gap-4">
            <p className="whitespace-nowrap text-[12px] font-[400] leading-[12px] tracking-[-0.02em] text-[#747775]">
              {stat.label}
            </p>
            <p className="text-[24px] font-[500] leading-[24px] tracking-[-0.02em] text-[#232A25]">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GradeDetailsStats;
