"use client";

import React, { useState, useEffect, useRef } from "react";

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getMonthName(monthNumber: number, year: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(year, monthNumber - 1));
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function getPrevMonthYear(month: number, year: number) {
  if (month === 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
}

const sampleTestDates = [
  { year: 2026, month: 3, day: 4, tests: 2 },
  { year: 2026, month: 3, day: 7, tests: 1 },
  { year: 2026, month: 3, day: 12, tests: 3 },
  { year: 2026, month: 3, day: 18, tests: 1 },
  { year: 2026, month: 3, day: 25, tests: 2 },
  { year: 2026, month: 4, day: 3, tests: 1 },
  { year: 2026, month: 4, day: 15, tests: 4 },
];

function hasTest(day: number, month: number, year: number) {
  return sampleTestDates.some((t) => t.day === day && t.month === month && t.year === year);
}

const Calendar = () => {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [isWide, setIsWide] = useState(false);
  const [yearPopupOpen, setYearPopupOpen] = useState(false);
  const yearPopupRef = useRef<HTMLDivElement>(null);

  const [today, setToday] = useState<{ day: number; month: number; year: number } | null>(null);

  useEffect(() => {
    const now = new Date();
    setToday({
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });
  }, []);

  useEffect(() => {
    const check = () => setIsWide(window.innerWidth >= 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (yearPopupRef.current && !yearPopupRef.current.contains(e.target as Node)) {
        setYearPopupOpen(false);
      }
    }
    if (yearPopupOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [yearPopupOpen]);

  const handleDecreaseMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else setMonth(month - 1);
  };

  const handleIncreaseMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else setMonth(month + 1);
  };

  const datePerRow = isWide ? 14 : 7;
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const daysInMonth = getDaysInMonth(month, year);
  const prev = getPrevMonthYear(month, year);
  const daysInPrevMonth = getDaysInMonth(prev.month, prev.year);
  const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / datePerRow) * datePerRow;
  const trailingDays = totalCells - (firstDayOfMonth + daysInMonth);

  const calendarCells: { day: number; currentMonth: boolean }[] = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) calendarCells.push({ day: daysInPrevMonth - i, currentMonth: false });
  for (let i = 1; i <= daysInMonth; i++) calendarCells.push({ day: i, currentMonth: true });
  for (let i = 1; i <= trailingDays; i++) calendarCells.push({ day: i, currentMonth: false });

  const weeks: (typeof calendarCells)[] = [];
  for (let i = 0; i < calendarCells.length; i += 7) weeks.push(calendarCells.slice(i, i + 7));

  const pairedWeeks: (typeof calendarCells)[] = [];
  if (isWide) {
    for (let i = 0; i < weeks.length; i += 2) pairedWeeks.push([...(weeks[i] || []), ...(weeks[i + 1] || [])]);
  }

  const cols = isWide ? 14 : 7;
  const headers = isWide ? [...WEEK_DAYS, ...WEEK_DAYS] : WEEK_DAYS;
  const rows = isWide ? pairedWeeks : weeks;

  const yearRange: number[] = [];
  for (let y = (today?.year || new Date().getFullYear()) - 10; y <= (today?.year || new Date().getFullYear()) + 10; y++)
    yearRange.push(y);

  return (
    <div className="p-4 bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[220px]">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Calendar</div>
        <div className="flex gap-1 items-center">
          <button className="mr-2" onClick={handleDecreaseMonth}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="#232A25"
              className="size-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div ref={yearPopupRef} className="relative">
            <button
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
          <button className="ml-2" onClick={handleIncreaseMonth}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="#232A25"
              className="size-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
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
