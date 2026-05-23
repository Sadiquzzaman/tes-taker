// useCalendar hook for Calendar component
import { useState, useEffect, useRef } from "react";
import {
  WEEK_DAYS,
  getMonthName,
  getDaysInMonth,
  getPrevMonthYear,
  hasTest,
  sampleTestDates,
} from "@/utils/Dashboard/calendar";

export const useCalendar = () => {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [isWide, setIsWide] = useState(false);
  const [yearPopupOpen, setYearPopupOpen] = useState(false);
  const yearPopupRef = useRef<HTMLDivElement>(null);
  const [today, setToday] = useState<{ day: number; month: number; year: number } | null>(null);

  // init today
  useEffect(() => {
    const now = new Date();
    setToday({ day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() });
  }, []);

  // responsive width
  useEffect(() => {
    const check = () => setIsWide(window.innerWidth >= 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // click outside year popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (yearPopupRef.current && !yearPopupRef.current.contains(e.target as Node)) {
        setYearPopupOpen(false);
      }
    };
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

  const calendarCells: CalendarCell[] = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) calendarCells.push({ day: daysInPrevMonth - i, currentMonth: false });
  for (let i = 1; i <= daysInMonth; i++) calendarCells.push({ day: i, currentMonth: true });
  for (let i = 1; i <= trailingDays; i++) calendarCells.push({ day: i, currentMonth: false });

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < calendarCells.length; i += 7) weeks.push(calendarCells.slice(i, i + 7));

  const pairedWeeks: CalendarCell[][] = [];
  if (isWide) {
    for (let i = 0; i < weeks.length; i += 2) pairedWeeks.push([...(weeks[i] || []), ...(weeks[i + 1] || [])]);
  }

  const cols = isWide ? 14 : 7;
  const headers = isWide ? [...WEEK_DAYS, ...WEEK_DAYS] : WEEK_DAYS;
  const rows = isWide ? pairedWeeks : weeks;

  const yearRange: number[] = [];
  for (
    let y = (today?.year || new Date().getFullYear()) - 10;
    y <= (today?.year || new Date().getFullYear()) + 10;
    y++
  ) {
    yearRange.push(y);
  }

  return {
    month,
    year,
    isWide,
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
    setMonth,
    setYear,
    WEEK_DAYS,
    hasTest,
    sampleTestDates,
  };
};
