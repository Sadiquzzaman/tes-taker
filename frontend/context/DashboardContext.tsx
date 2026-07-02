"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import useTeacherDashboard from "@/hooks/api/dashboard/useTeacherDashboard";

type DashboardContextValue = {
  data: TeacherDashboardPayload | null;
  loading: boolean;
  error: string | null;
  refetch: (params?: TeacherDashboardQuery) => Promise<void>;
  activityPeriod: DashboardActivityPeriod;
  setActivityPeriod: (period: DashboardActivityPeriod) => void;
  calendarYear: number;
  calendarMonth: number;
  setCalendarMonth: (month: number) => void;
  setCalendarYear: (year: number) => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export const DashboardProvider = ({ children }: { children: React.ReactNode }) => {
  const now = new Date();
  const [activityPeriod, setActivityPeriod] = useState<DashboardActivityPeriod>("monthly");
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1);

  const query = useMemo(
    () => ({
      activity_period: activityPeriod,
      calendar_year: calendarYear,
      calendar_month: calendarMonth,
    }),
    [activityPeriod, calendarYear, calendarMonth],
  );

  const { data, loading, error, refetch } = useTeacherDashboard(query);

  const value = useMemo(
    () => ({
      data,
      loading,
      error,
      refetch,
      activityPeriod,
      setActivityPeriod,
      calendarYear,
      calendarMonth,
      setCalendarMonth,
      setCalendarYear,
    }),
    [data, loading, error, refetch, activityPeriod, calendarYear, calendarMonth],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};

export const useDashboard = (): DashboardContextValue => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return context;
};
