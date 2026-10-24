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
        <div key={stat.label} className="flex flex-1 gap-4 rounded-card bg-canvas p-4">
          <ParticipantIconSVG />
          <div className="flex flex-col gap-4">
            <p className="whitespace-nowrap text-caption font-normal text-ink-muted">
              {stat.label}
            </p>
            <p className="text-title font-medium text-ink">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GradeDetailsStats;
