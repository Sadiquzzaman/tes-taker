"use client";

import React, { useEffect, useState } from "react";
import ParticipantIconSVG from "../svg/ParticipantIconSVG";
import SubmittedIconSVG from "../svg/SubmittedIconSVG";
import ChevronLeftIconSVG from "../svg/ChevronLeftIconSVG";
import ChevronRightIconSVG from "../svg/ChevronRightIconSVG";
import LiveTestTimerIconSVG from "../svg/LiveTestTimerIconSVG";
import { useDashboard } from "@/context/DashboardContext";
import DashboardEmptyState from "./DashboardEmptyState";
import DashboardWidgetSkeleton from "./DashboardWidgetSkeleton";
import { formatRemainingTime } from "@/utils/Dashboard/format";

const LiveTest = () => {
  const { data, loading } = useDashboard();
  const liveTests = data?.live_tests ?? [];
  const [index, setIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const currentTest = liveTests[index] ?? null;

  useEffect(() => {
    setIndex(0);
  }, [liveTests.length]);

  useEffect(() => {
    if (!currentTest) {
      return;
    }
    setRemainingSeconds(currentTest.remaining_seconds);
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentTest?.id, currentTest?.remaining_seconds]);

  const goPrev = () => {
    if (liveTests.length <= 1) return;
    setIndex((prev) => (prev === 0 ? liveTests.length - 1 : prev - 1));
  };

  const goNext = () => {
    if (liveTests.length <= 1) return;
    setIndex((prev) => (prev === liveTests.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
      {loading ? (
        <div className="p-4">
          <DashboardWidgetSkeleton lines={5} />
        </div>
      ) : liveTests.length === 0 ? (
        <div className="p-4 h-full">
          <DashboardEmptyState
            title="No live tests"
            description="Published tests that are currently running will appear here."
            ctaLabel="Create Test"
            ctaHref="/tests/create"
          />
        </div>
      ) : (
        <>
          <div className="p-4 h-[55%]">
            <div className="flex justify-between items-center">
              <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Live test</div>
              {liveTests.length > 1 && (
                <div className="flex gap-1 items-center">
                  <button type="button" className="mr-2 text-[#232A25]" onClick={goPrev}>
                    <ChevronLeftIconSVG className="size-4" />
                  </button>
                  {liveTests.map((test, dotIndex) => (
                    <button
                      type="button"
                      key={test.id}
                      className={`w-1.5 h-1.5 cursor-pointer rounded-full ${dotIndex === index ? "bg-[#49734F]" : "bg-[#E5E5E5]"}`}
                      onClick={() => setIndex(dotIndex)}
                      aria-label={`Show live test ${dotIndex + 1}`}
                    />
                  ))}
                  <button type="button" className="ml-2 text-[#232A25]" onClick={goNext}>
                    <ChevronRightIconSVG className="size-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="mt-8 mb-2 font-[500] text-[20px] leading-[20px] tracking-[-0.02em] text-[#232A25] truncate">
              {currentTest?.test_name ?? "Untitled test"}
            </div>
            <div className="flex justify-between items-center">
              <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775] truncate">
                {currentTest?.class_name ?? "No class"}
              </div>
              <div className="flex gap-1 items-center shrink-0">
                <div className="text-[#49734F]">
                  <LiveTestTimerIconSVG width={14} />
                </div>
                <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">
                  {formatRemainingTime(remainingSeconds)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-[50%]">
            <div className="px-4 py-2 w-[50%] border-t border-r border-gray-200 h-full flex flex-col justify-evenly gap-2">
              <ParticipantIconSVG />
              <div className="font-[500] text-[20px] leading-[20px] tracking-[-0.02em] text-[#232A25]">
                {currentTest?.participant_count ?? 0}
              </div>
              <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">Participants</div>
            </div>
            <div className="px-4 py-2 w-[50%] border-t border-gray-200 h-full flex flex-col justify-evenly gap-2">
              <SubmittedIconSVG />
              <div className="font-[500] text-[20px] leading-[20px] tracking-[-0.02em] text-[#232A25]">
                {currentTest?.submitted_count ?? 0}
              </div>
              <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">Submitted</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LiveTest;
