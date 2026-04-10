import { useAppDispatch } from "@/lib/hooks";
import CalenderIconSVG from "../svg/CalenderIconSVG";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import ShareIconSVG from "../svg/ShareIconSVG";
import { setNewTestCreated } from "@/lib/features/testSlice";

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
}: {
  cardBackground?: string;
  from?: string;
  testData: Test;
}) => {
  const dispatch = useAppDispatch();

  const testStatus = "MarkingPending" as "Ongoing" | "Completed" | "MarkingPending";
  const statusColors = {
    Ongoing: "rgba(0,233,33,0.15)",
    Completed: "rgba(73,115,79,0.15)",
    MarkingPending: "#ED860025",
  };
  const statusTextColors = {
    Ongoing: "#49734F",
    Completed: "#49734F",
    MarkingPending: "#ED8600",
  };
  return (
    <div
      style={{ background: cardBackground }}
      className={`w-full p-2 sm:p-4 flex flex-col items-center gap-6 rounded-lg`}
    >
      <div className="w-full flex justify-between items-center">
        <h2 className="text-[18px] font-[500] leading-[100%] tracking-[-0.02em] text-[#49734F]">
          Algebra Midterm Assessment
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
            <p className="font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25] pt-2">
              {testData?.class?.class_name}
            </p>
          </div>
        )}
        <div className="w-1/2 lg:flex-1">
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Subject</p>
          <p className="font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25] pt-2">
            {testData?.subject}
          </p>
        </div>
        <div className="w-1/2 lg:flex-1">
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Participants</p>
          <p className="font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25] pt-2">28</p>
        </div>
        <div className="w-1/2 lg:flex-1">
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Submitted</p>
          <p className="font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25] pt-2">09</p>
        </div>
      </div>
      <div className="w-full flex flex-col gap-4">
        <div className="w-full flex items center justify-between">
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Submission progress</p>
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">09/28</p>
        </div>
        <div className="w-full h-1 rounded-[23px] bg-[#E5E5E5]">
          <div
            style={{ background: statusTextColors[testStatus], width: `${(9 / 28) * 100}%` }}
            className="h-full rounded-[23px]"
          ></div>
        </div>
      </div>
      <div className="w-full flex items-center justify-between text-[#232A25] gap-2">
        <div className="flex items-center gap-2">
          <CalenderIconSVG />
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em]">
            {`${new Date(testData?.exam_start_time).toLocaleString("en-US", formatOptions)} - ${new Date(testData?.exam_end_time).toLocaleString("en-US", formatOptions)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[#747775]">
          {from === "testList" && (
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
                onClick={() => dispatch(setNewTestCreated(testData2))}
              >
                <ShareIconSVG width={16} />
              </button>
            </>
          )}

          <button
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
            {testStatus === "Ongoing"
              ? "View details"
              : testStatus === "Completed"
                ? "View results"
                : "Continue marking"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestCard;

const testData2 = {
  id: "1775818174304",
  testName: "dsfsdf",
  shareLink: "http://localhost:3000/tests?createdTest=1775818174304",
  type: "new",
  test: {
    formState: {
      examType: "mcq",
      testName: "dsfsdf",
      duration: "90",
      passingScore: "",
      allowNegativeMarking: true,
      negativeMarking: "25",
    },
    subjects: [
      {
        id: "1775818150802-h3j4g0m",
        name: "English",
        value: "english",
        questionSections: [
          {
            id: "1775818150802-6aocw3c",
            type: "objective",
            headerText: "Objective Questions",
            questions: [
              {
                id: "1775818150802-11cknah",
                text: "sfsf",
                image: null,
                options: [
                  {
                    id: "1775818160962-wlhwx4k",
                    text: "sdfsf",
                    image: null,
                  },
                ],
                correctOptionId: "1775818160962-wlhwx4k",
                points: 2,
                showValidation: false,
              },
            ],
          },
        ],
      },
    ],
    publishState: {
      publishTiming: "schedule",
      scheduleAt: "2026-04-10T12:48:47.480Z",
      endingAt: "2026-04-13T09:48:47.480Z",
      testAudience: "anyone",
      selectedClassId: "",
      specificStudents: [],
    },
  },
};
