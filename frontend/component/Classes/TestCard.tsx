import { useAppDispatch } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import CalenderIconSVG from "../svg/CalenderIconSVG";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import PlayIconSVG from "../svg/PlayIconSVG";
import ShareIconSVG from "../svg/ShareIconSVG";
import { setNewTestCreated } from "@/lib/features/testSlice";
import {
  getTestAudienceLabel,
  getTestCounts,
  getTestScheduleRange,
  getTestSubjectLabel,
  isTeacherExamListItem,
} from "@/utils/tests/testListItem";

const formatOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

const TestCard = ({
  cardBackground = "rgba(239,240,243,0.75)",
  from = "",
  testData,
  role = "TEACHER",
}: {
  cardBackground?: string;
  from?: string;
  testData: TestListItem;
  role?: RoleUserType;
}) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const primarySubjectName = getTestSubjectLabel(testData);
  const audienceName = getTestAudienceLabel(testData);
  const { participantCount, submittedCount } = getTestCounts(testData);
  const { startAt, endAt } = getTestScheduleRange(testData);
  const submissionProgress = participantCount > 0 ? (submittedCount / participantCount) * 100 : 0;
  const isStudent = role === "STUDENT";
  const isTeacher = role === "TEACHER";

  // const testStatus = "pending" as "ongoing" | "completed" | "pending";
  const testStatus = testData.status;
  const isStudentOngoingTest = isStudent && testStatus === "ongoing";
  const statusColors: Record<string, string> = {
    ongoing: "rgba(0,233,33,0.15)",
    completed: "rgba(73,115,79,0.15)",
    pending: "#ED860025",
  };
  const statusTextColors: Record<string, string> = {
    ongoing: "#49734F",
    completed: "#49734F",
    pending: "#ED8600",
  };

  const handleStudentOngoingTestAction = () => {
    sessionStorage.setItem("testId", testData.id);
    router.push("/test/permissions");
  };

  const handlePrimaryAction = () => {
   
  };

  return (
    <div
      style={{ background: cardBackground }}
      className={`w-full p-2 sm:p-4 flex flex-col items-center gap-6 rounded-lg`}
    >
      <div className="w-full flex justify-between items-center">
        <h2 className="text-[18px] font-[500] leading-[100%] tracking-[-0.02em] text-[#49734F]">
          {testData.test_name}
        </h2>
        <span
          style={{ background: statusColors[testStatus] }}
          className={`px-2 py-1 text-[12px] font-[500] leading-[12px] tracking-[-0.02em] text-[${statusTextColors[testStatus]}] border border-[${statusTextColors[testStatus]}] rounded-[27px] box-border`}
        >
          {testStatus}
        </span>
      </div>
      <div className="w-full flex flex-wrap items-center justify-between gap-y-2">
        {from === "testList" && (
          <div className="w-1/2 lg:flex-1">
            <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Audience </p>
            <p className="font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25] pt-2">{audienceName}</p>
          </div>
        )}
        <div className="w-1/2 lg:flex-1">
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Subject</p>
          <p className="font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25] pt-2">
            {primarySubjectName}
          </p>
        </div>
        <div className="w-1/2 lg:flex-1">
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Participants</p>
          <p className="font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25] pt-2">{participantCount}</p>
        </div>
        <div className="w-1/2 lg:flex-1">
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Submitted</p>
          <p className="font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25] pt-2">{submittedCount}</p>
        </div>
      </div>
      <div className="w-full flex flex-col gap-4">
        <div className="w-full flex items center justify-between">
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Submission progress</p>
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">
            {submittedCount}/{participantCount}
          </p>
        </div>
        <div className="w-full h-1 rounded-[23px] bg-[#E5E5E5]">
          <div
            style={{ background: statusTextColors[testStatus], width: `${submissionProgress}%` }}
            className="h-full rounded-[23px]"
          ></div>
        </div>
      </div>
      <div className="w-full flex items-center justify-between text-[#232A25] gap-2">
        <div className="flex items-center gap-2">
          <CalenderIconSVG />
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em]">
            {startAt && endAt
              ? `${new Date(startAt).toLocaleString("en-US", formatOptions)} - ${new Date(endAt).toLocaleString("en-US", formatOptions)}`
              : "N/A"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[#747775]">
          {from === "testList" && isTeacher && (
            <>
              <button
                title="Add Students"
                className="w-8 h-8 flex justify-center items-center rounded-[8px] hover:bg-[#EFF0F3]"
                // onClick={() => dispatch(setOpenAddStudentModal(classItem))}
              >
                <HumanAddIconSVG width={16} />
              </button>
              <button
                title="Share Tests"
                className="w-8 h-8 flex justify-center items-center rounded-[8px] hover:bg-[#EFF0F3]"
                onClick={() => {
                  if (isTeacherExamListItem(testData)) {
                    dispatch(setNewTestCreated({ type: "existing", test: testData }));
                  }
                }}
              >
                <ShareIconSVG width={16} />
              </button>
            </>
          )}

          {isStudentOngoingTest ? (
            <button
              type="button"
              onClick={handleStudentOngoingTestAction}
              className="flex items-center justify-center gap-2 rounded-[8px] bg-[#49734F] px-3 py-2 text-[12px] font-[500] leading-[16px] tracking-[-0.02em] text-white transition-colors duration-200 hover:bg-[#3f6244]"
            >
              <PlayIconSVG className="size-4" />
              <span className="capitalize">Start Test</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="px-3 py-2 text-[12px] font-[500] leading-[12px] tracking-[-0.02em] border rounded-lg transition-all duration-200"
              style={{
                color: statusTextColors[testStatus],
                borderColor: statusTextColors[testStatus],
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = statusTextColors[testStatus];
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = statusTextColors[testStatus];
              }}
            >
              {testStatus === "ongoing"
                ? "View details"
                : testStatus === "completed"
                  ? "View results"
                  : "Continue marking"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestCard;
