"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import { useAppSelector } from "@/lib/hooks";
import { useState } from "react";

const ProctoringFlagListModal = () => {
  const flags = useAppSelector((state) => state.proctoring.flags);
  const [isOpen, setIsOpen] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy JSON");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(flags, null, 2));
    setCopyLabel("Copied");
    window.setTimeout(() => {
      setCopyLabel("Copy JSON");
    }, 1500);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-[8px] border border-[#DDE5DE] px-3 py-2 text-left text-[12px] font-[500] leading-4 text-[#232A25]"
      >
        List of Flag
      </button>

      <CreateModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidthClassName="max-w-[520px]"
        panelClassName="p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[18px] font-[600] leading-6 text-[#232A25]">Flag List</p>
              <p className="text-[13px] leading-5 text-[#747775]">Dev-only list from Redux proctoring state.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="rounded-[8px] border border-[#DDE5DE] px-3 py-2 text-[12px] font-[500] leading-4 text-[#232A25]"
              >
                {copyLabel}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-[8px] border border-[#DDE5DE] px-3 py-2 text-[12px] font-[500] leading-4 text-[#232A25]"
              >
                Close
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-[12px] border border-[#E6ECE7]">
            <table className="w-full border-collapse">
              <thead className="bg-[#F8FBF8]">
                <tr>
                  <th className="px-4 py-3 text-left text-[12px] font-[600] leading-4 text-[#49734F]">Flag Type</th>
                  <th className="px-4 py-3 text-left text-[12px] font-[600] leading-4 text-[#49734F]">Penalty</th>
                </tr>
              </thead>

              <tbody>
                {flags.length > 0 ? (
                  flags.map((flag) => (
                    <tr key={flag.id} className="border-t border-[#E6ECE7]">
                      <td className="px-4 py-3 text-[13px] leading-5 text-[#232A25]">{flag.type}</td>
                      <td className="px-4 py-3 text-[13px] font-[600] leading-5 text-[#232A25]">{flag.points}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-[13px] leading-5 text-[#747775]">
                      No flags yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CreateModal>
    </>
  );
};

export default ProctoringFlagListModal;
