"use client";

import axiosReq from "@/lib/axios";
import { Fragment, useEffect, useState } from "react";

type RosterStudent = {
  student_id: string;
  student_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  started_at: string | null;
  submitted_at: string | null;
  duration_seconds: number | null;
  total_score: number | null;
  max_score: number | null;
  is_graded: boolean;
  browser_switch_count: number;
  tab_switch_count: number;
  disqualification_reason: string | null;
  proctoring_summary: {
    total_violations: number;
    total_red_flag_points: number;
    counts_by_type: Record<string, number>;
  };
  proctoring_events: Array<{
    id: string;
    type: string;
    message: string;
    points?: number;
    timestamp: string;
  }>;
};

type RosterPayload = {
  exam: { id: string; test_name: string; class_name: string | null };
  counts: {
    not_started: number;
    in_progress: number;
    submitted: number;
    auto_submitted: number;
    disqualified: number;
  };
  students: RosterStudent[];
};

const ExamClassRosterPanel = ({ examId }: { examId: string }) => {
  const [payload, setPayload] = useState<RosterPayload | null>(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await axiosReq.get(
          `${process.env.NEXT_PUBLIC_BASE_URL}/exams/grading/${examId}/roster`,
        );
        if (active) {
          setPayload(response.data.payload);
        }
      } catch {
        if (active) {
          setError("Unable to load exam roster.");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [examId]);

  if (error) {
    return <p className="text-[14px] text-[#D24B44]">{error}</p>;
  }

  if (!payload) {
    return <p className="text-[14px] text-[#747775]">Loading class roster…</p>;
  }

  return (
    <div className="flex flex-col gap-4 rounded-[8px] bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[20px] font-[600] text-[#232A25]">Class exam dashboard</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {(
          [
            ["Not started", payload.counts.not_started],
            ["In progress", payload.counts.in_progress],
            ["Submitted", payload.counts.submitted],
            ["Auto submitted", payload.counts.auto_submitted],
            ["Disqualified", payload.counts.disqualified],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-[8px] border border-[#E5E5E5] p-3">
            <p className="text-[12px] text-[#747775]">{label}</p>
            <p className="text-[22px] font-[600] text-[#232A25]">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#EFF0F3] text-[#232A25]">
              <th className="p-2">Student</th>
              <th className="p-2">Status</th>
              <th className="p-2">Submitted</th>
              <th className="p-2">Duration</th>
              <th className="p-2">Score</th>
              <th className="p-2">Graded</th>
              <th className="p-2">Violations</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {payload.students.map((student) => (
              <Fragment key={student.student_id}>
                <tr className="border-b border-[#EFF0F3] text-[#747775]">
                  <td className="p-2">{student.student_name || "Anonymous"}</td>
                  <td className="p-2">{student.status}</td>
                  <td className="p-2">{student.submitted_at ? new Date(student.submitted_at).toLocaleString() : "—"}</td>
                  <td className="p-2">
                    {student.duration_seconds != null ? `${Math.round(student.duration_seconds / 60)} min` : "—"}
                  </td>
                  <td className="p-2">
                    {student.total_score != null && student.max_score != null
                      ? `${student.total_score}/${student.max_score}`
                      : "—"}
                  </td>
                  <td className="p-2">{student.is_graded ? "Yes" : "No"}</td>
                  <td className="p-2">{student.proctoring_summary.total_violations}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      className="text-[#49734F] underline"
                      onClick={() =>
                        setExpandedId((current) => (current === student.student_id ? null : student.student_id))
                      }
                    >
                      Details
                    </button>
                  </td>
                </tr>
                {expandedId === student.student_id ? (
                  <tr className="bg-[#F7F8F7]">
                    <td colSpan={8} className="p-3 text-[13px] text-[#232A25]">
                      <p>
                        <strong>Browser switches:</strong> {student.browser_switch_count} ·{" "}
                        <strong>Tab switches:</strong> {student.tab_switch_count} ·{" "}
                        <strong>Red-flag points:</strong> {student.proctoring_summary.total_red_flag_points}
                      </p>
                      {student.disqualification_reason ? (
                        <p className="mt-1 text-[#D24B44]">
                          <strong>Disqualification:</strong> {student.disqualification_reason}
                        </p>
                      ) : null}
                      <ul className="mt-2 max-h-48 list-disc overflow-auto pl-5">
                        {student.proctoring_events.length ? (
                          student.proctoring_events.map((event) => (
                            <li key={event.id}>
                              [{new Date(event.timestamp).toLocaleString()}] {event.type}: {event.message}
                              {event.points ? ` (+${event.points})` : ""}
                            </li>
                          ))
                        ) : (
                          <li>No persisted violations.</li>
                        )}
                      </ul>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExamClassRosterPanel;
