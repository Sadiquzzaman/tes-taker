import Link from "next/link";
import { useMemo, useState } from "react";
import FileIconSVG from "../svg/FileIconSVG";
import TestCard from "./TestCard";
import useWorkspace from "@/hooks/organization/useWorkspace";

const classTestTabList = [
  { name: "All", value: "all" },
  { name: "Active", value: "ongoing" },
  { name: "Marking Pending", value: "pending" },
  { name: "Completed", value: "completed" },
];

const ClassTests = ({ testList, role }: { testList: TestListItem[]; role: RoleUserType | undefined }) => {
  const [activeTestTab, setActiveTestTab] = useState(classTestTabList[0]);
  const { memberRole, isIndividual } = useWorkspace();
  const canCreateTest =
    role === "TEACHER" && (isIndividual || (memberRole !== "ASSISTANT" && memberRole !== "STUDENT"));
  const filteredTestList = useMemo(() => {
    if (activeTestTab.value === "all") {
      return testList;
    }

    return testList.filter((test) => test.status === activeTestTab.value);
  }, [activeTestTab.value, testList]);

  return (
    <div className="p-2 sm:p-4 bg-surface rounded-input h-full">
      <div className="flex justify-between items-center">
        <p className="font-medium text-title text-ink">Tests</p>

        {canCreateTest && (
          <Link href="/tests/create">
            <button className="flex items-center justify-center gap-2 w-[108px] sm:w-[128px] h-[32px] bg-primary rounded-input font-medium text-ink-inverse font-medium text-caption sm:text-body-sm">
              <FileIconSVG width={16} />
              <span className="capitalize mb-[2px]">Create Test</span>
            </button>
          </Link>
        )}
      </div>
      <div className="py-4 flex flex-col sm:flex-row justify-start sm:justify-between items-start sm:items-center w-full min-h-10 mb-2">
        <div className="flex w-fit rounded-md bg-canvas p-0.5">
          {classTestTabList.map((tab) => (
            <button
              key={tab.value}
              className={`px-4 py-2 text-sm rounded ${
                activeTestTab.value === tab.value ? "font-normal bg-surface shadow text-ink" : "text-ink-muted"
              }`}
              onClick={() => setActiveTestTab(tab)}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2 sm:gap-4">
        {filteredTestList.map((test) => (
          <TestCard key={test.id} testData={test} role={role} />
        ))}
      </div>
      {filteredTestList.length === 0 && (
        <div className="w-full min-h-[100px] flex items-center justify-center">
          <div className="text-center">
            <p className="font-semibold text-title tracking-tight text-ink">Test not found</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassTests;
