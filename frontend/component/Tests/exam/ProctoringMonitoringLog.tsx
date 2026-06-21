"use client";

import { memo } from "react";

interface ProctoringMonitoringLogProps {
  flags: ProctoringFlag[];
  className?: string;
}

const ProctoringMonitoringLog = ({ flags, className = "" }: ProctoringMonitoringLogProps) => {
  const recentFlags = [...flags].reverse().slice(0, 6);

  return (
    <div className={`rounded-[10px] border border-[#E6ECE7] bg-white p-3 ${className}`}>
      <p className="text-[13px] font-[600] leading-4 text-[#232A25]">Monitoring</p>
      <ul className="mt-3 flex max-h-[180px] flex-col gap-2 overflow-y-auto">
        {recentFlags.length > 0 ? (
          recentFlags.map((flag) => (
            <li key={flag.id} className="rounded-[8px] bg-[#F8FBF8] px-3 py-2 text-[12px] leading-4 text-[#49734F]">
              {flag.message}
            </li>
          ))
        ) : (
          <li className="px-1 py-2 text-[12px] leading-4 text-[#747775]">No violations detected yet.</li>
        )}
      </ul>
    </div>
  );
};

export default memo(ProctoringMonitoringLog);
