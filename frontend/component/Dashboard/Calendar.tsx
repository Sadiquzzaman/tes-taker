"use client";

import React from "react";
import ChevronLeftIconSVG from "../svg/ChevronLeftIconSVG";
import ChevronRightIconSVG from "../svg/ChevronRightIconSVG";
import { useCalendar } from "@/hooks/Dashboard/useCalendar";
import { getMonthName } from "@/utils/Dashboard/calendar";

const Calendar = () => {
  const {
    month,
    year,
    yearPopupOpen,
    setYearPopupOpen,
    yearPopupRef,
    today,
    handleDecreaseMonth,
    handleIncreaseMonth,
    cols,
    headers,
    rows,
    yearRange,
    setYear,
    hasTest,
  } = useCalendar();

  return (
    <div className="p-4 bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[220px]">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Calendar</div>
        <div className="flex gap-1 items-center">
          <button type="button" className="mr-2 text-[#232A25]" onClick={handleDecreaseMonth}>
            <ChevronLeftIconSVG className="size-4" strokeWidth={2.5} />
          </button>
          <div ref={yearPopupRef} className="relative">
            <button
              type="button"
              className="mb-[1px] text-center font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em] w-28 hover:opacity-70 transition-opacity"
              onClick={() => setYearPopupOpen((v) => !v)}
            >
              {getMonthName(month, year)} {year}
            </button>
            {yearPopupOpen && (
              <div className="absolute top-7 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-52">
                <div className="text-[12px] font-[500] text-[#747775] mb-2 text-center">Select Year</div>
                <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">
                  {yearRange.map((y) => (
                    <button
                      type="button"
                      key={y}
                      onClick={() => {
                        setYear(y);
                        setYearPopupOpen(false);
                      }}
                      className={`text-[13px] py-1 rounded-lg font-[500] transition-colors
                        ${y === year ? "bg-[#49734F] text-white" : "text-[#232A25] hover:bg-[#EFF0F3]"}`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button type="button" className="ml-2 text-[#232A25]" onClick={handleIncreaseMonth}>
            <ChevronRightIconSVG className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <div className="mt-4" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {headers.map((shortName, index) => (
          <span
            key={index}
            className="text-[14px] leading-[20px] text-[#747775] text-center font-[500] tracking-[-0.02em]"
          >
            {shortName}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {rows.map((rowCells, rIdx) => (
          <div key={rIdx} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {rowCells.map((cell, cIdx) => {
              const isToday =
                today && cell.currentMonth && cell.day === today.day && month === today.month && year === today.year;
              const showDot = hasTest(cell.day, month, year);
              return (
                <div
                  key={cIdx}
                  className="flex flex-col gap-1 items-center justify-center h-10 w-full"
                  style={{
                    fontSize: "14px",
                    lineHeight: "20px",
                    fontWeight: 400,
                    borderRadius: isToday ? "10px" : undefined,
                    background: isToday ? "#49734F" : "transparent",
                    color: isToday ? "#ffffff" : cell.currentMonth ? "#232A25" : "#B0B4B9",
                    textAlign: "center",
                    verticalAlign: "middle",
                  }}
                >
                  <div>{cell.day}</div>
                  {showDot && (
                    <div
                      className="w-1 h-1 rounded-full"
                      style={{
                        background: isToday ? "white" : cell.currentMonth ? "#49734F" : "#B0B4B9",
                      }}
                    />
                  )}
                  {!showDot && <div className="w-1 h-1" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Calendar;
