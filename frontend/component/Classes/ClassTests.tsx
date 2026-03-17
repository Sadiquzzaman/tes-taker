import Link from "next/link";
import { useState } from "react";
import FileIconSVG from "../svg/FileIconSVG";
import TestCard from "./TestCard";

const classTestTabList = [
  { name: "Active", value: "active" },
  { name: "Marking Pending", value: "marking_pending" },
  { name: "Completed", value: "completed" },
];

const ClassTests = ({ testList }: { testList: Test[] }) => {
  const [activeTestTab, setActiveTestTab] = useState(classTestTabList[0]);
  return (
    <div className="p-2 sm:p-4 bg-white rounded-[8px] h-full">
      <div className="flex justify-between items-center">
        <p className="font-[500] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">Tests</p>

        <Link href="/tests/create">
          <button className="flex items-center justify-center gap-2 w-[108px] sm:w-[128px] h-[32px] bg-[#49734F] rounded-[8px] font-[500] text-white font-medium text-[12px] sm:text-[14px]">
            <FileIconSVG width={16} />
            <span className="capitalize mb-[2px]">Create Test</span>
          </button>
        </Link>
      </div>
      <div className="py-4 flex flex-col sm:flex-row justify-start sm:justify-between items-start sm:items-center w-full min-h-10 mb-2">
        <div className="flex w-fit rounded-md bg-gray-100 p-0.5">
          {classTestTabList.map((tab) => (
            <button
              key={tab.value}
              className={`px-4 py-2 text-sm rounded leading-[20px] tracking-[-0.02em] ${
                activeTestTab.value === tab.value ? "font-[400] bg-white shadow text-[#232A25]" : "text-[#747775]"
              }`}
              onClick={() => setActiveTestTab(tab)}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-4">
        {testList.map((test) => (
          <TestCard key={test.id} testData={test} />
        ))}
      </div>
    </div>
  );
};

export default ClassTests;
