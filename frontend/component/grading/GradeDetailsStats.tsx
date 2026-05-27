import ParticipantIconSVG from "../svg/ParticipantIconSVG";

const GradeDetailsStats = ({ gradedCount, pendingCount, submissions, totalStudents }: GradeDetailsStatsProps) => {
  const stats = [
    { label: "Total students", value: totalStudents },
    { label: "Submissions", value: submissions },
    { label: "Pending", value: pendingCount },
    { label: "Graded", value: gradedCount },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      {stats.map((stat) => (
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
