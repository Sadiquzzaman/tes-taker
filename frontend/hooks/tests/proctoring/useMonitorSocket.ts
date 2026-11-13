"use client";

import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import axiosReq from "@/lib/axios";
import { getProctoringSocketUrl } from "@/utils/tests/proctoringSocket";

type Sessions = Record<string, MonitorSession>;

const storedToken = () => {
  try {
    return (JSON.parse(localStorage.getItem("user") ?? "null") as { access_token?: string } | null)?.access_token ?? null;
  } catch {
    return null;
  }
};

/**
 * The live monitor's data (P8-03, PRO-03, PRO-07): the sessions (with time left) from the API,
 * kept current by the monitor socket's events; `alerts` collects students who reached the exam's
 * alert level (PRO-08). Refreshes the list every 30 seconds for deadlines and late joiners.
 */
const useMonitorSocket = (examId: string) => {
  const [sessions, setSessions] = useState<Sessions | null>(null);
  const [failed, setFailed] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<{ studentId: string; studentName: string; flagCount: number; at: number }[]>([]);

  const patch = useCallback((studentId: string, change: Partial<MonitorSession>) => {
    setSessions((all) => (all && all[studentId] ? { ...all, [studentId]: { ...all[studentId], ...change } } : all));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await axiosReq.get<ApiResponse<{ sessions: MonitorSession[] }>>(`${process.env.NEXT_PUBLIC_BASE_URL}/exams/${examId}/proctoring/sessions`);
      setSessions(Object.fromEntries(res.data.payload.sessions.map((s) => [s.studentId, s])));
      setFailed(null);
    } catch (error) {
      setFailed((error as { response?: { status?: number } }).response?.status ?? 0);
    }
  }, [examId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const url = getProctoringSocketUrl(process.env.NEXT_PUBLIC_SOCKET_URL, process.env.NEXT_PUBLIC_BASE_URL);
    const token = storedToken();
    if (!url || !token) return;
    const socket = io(url, { autoConnect: false, auth: { token }, transports: ["websocket", "polling"], withCredentials: true });
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("exam:join", { examId, role: "monitor" });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("session:joined", () => void load());
    socket.on("flag:update", (e: { studentId: string; flagCount: number; totalFlagPoints: number; flag: MonitorSession["latestFlag"] }) =>
      patch(e.studentId, { flagCount: e.flagCount, totalFlagPoints: e.totalFlagPoints, latestFlag: e.flag, liveStatus: "WRITING" }),
    );
    socket.on("session:lost", (e: { studentId: string; lostSince: string }) => patch(e.studentId, { liveStatus: "LOST", lostSince: e.lostSince }));
    socket.on("session:back", (e: { studentId: string }) => patch(e.studentId, { liveStatus: "WRITING", lostSince: null }));
    socket.on("session:left", (e: { studentId: string }) => patch(e.studentId, { liveStatus: "DISCONNECTED" }));
    socket.on("session:ended", (e: { studentId: string }) => patch(e.studentId, { liveStatus: "ENDED" }));
    socket.on("exam:submitted", (e: { studentId: string }) => patch(e.studentId, { liveStatus: "SUBMITTED" }));
    socket.on("alert", (e: { studentId: string; studentName: string; flagCount: number }) => setAlerts((all) => [{ ...e, at: Date.now() }, ...all].slice(0, 20)));
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [examId, load, patch]);

  return { sessions: sessions ? Object.values(sessions) : null, failed, connected, alerts, reload: load, patch };
};

export default useMonitorSocket;
