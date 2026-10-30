"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import useScoreText from "@/component/GradingScale/useScoreText";
import { Button, Card, ErrorState, Modal, Skeleton, StatTile, Table, type TableColumn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

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
  grade?: Grade | null;
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

const COUNT_KEYS = ["not_started", "in_progress", "submitted", "auto_submitted", "disqualified"] as const;

/** Where every student in the class stands on this test, with their proctoring flags. */
const ExamClassRosterPanel = ({ examId }: { examId: string }) => {
  const t = useTranslations("grading.roster");
  const tSubmissions = useTranslations("grading.submissions");
  const format = useFormat();
  const scoreText = useScoreText();
  const [payload, setPayload] = useState<RosterPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<RosterStudent | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await axiosReq.get(`${process.env.NEXT_PUBLIC_BASE_URL}/exams/grading/${examId}/roster`);
        if (active) {
          setFailed(false);
          setPayload(response.data.payload);
        }
      } catch {
        if (active) setFailed(true);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [examId, attempt]);

  const statusLabel = (status: string) => {
    const key = status.toLowerCase() as (typeof COUNT_KEYS)[number];
    return COUNT_KEYS.includes(key) ? t(key) : status;
  };
  const anonymous = tSubmissions("anonymous");

  const columns: TableColumn<RosterStudent>[] = [
    { key: "name", header: t("student"), cell: (row) => row.student_name || anonymous, sortValue: (row) => row.student_name },
    { key: "status", header: t("status"), cell: (row) => statusLabel(row.status), sortValue: (row) => row.status },
    {
      key: "submitted",
      header: t("submittedAt"),
      cell: (row) => (row.submitted_at ? format.dateTime(row.submitted_at) : "—"),
      sortValue: (row) => (row.submitted_at ? new Date(row.submitted_at) : null),
      hideOnMobile: true,
      className: "whitespace-nowrap",
    },
    {
      key: "duration",
      header: t("duration"),
      cell: (row) => (row.duration_seconds != null ? t("minutes", { minutes: Math.round(row.duration_seconds / 60) }) : "—"),
      sortValue: (row) => row.duration_seconds,
      hideOnMobile: true,
      align: "right",
    },
    {
      key: "score",
      header: t("score"),
      cell: (row) => scoreText({ score: row.total_score, max: row.max_score, grade: row.grade }),
      align: "right",
    },
    { key: "graded", header: t("graded"), cell: (row) => (row.is_graded ? t("yes") : t("no")), hideOnMobile: true },
    {
      key: "flags",
      header: t("violations"),
      cell: (row) => format.number(row.proctoring_summary.total_violations),
      sortValue: (row) => row.proctoring_summary.total_violations,
      align: "right",
    },
    {
      key: "action",
      header: t("details"),
      align: "right",
      cell: (row) => (
        <Button size="sm" variant="ghost" onClick={() => setSelected(row)}>
          {t("details")}
        </Button>
      ),
    },
  ];

  return (
    <Card title={t("title")}>
      {failed ? (
        <ErrorState title={t("loadFailed")} onRetry={() => setAttempt((value) => value + 1)} />
      ) : !payload ? (
        <div aria-busy="true">
          <Skeleton lines={4} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {COUNT_KEYS.map((key) => (
              <StatTile key={key} label={t(key)} value={payload.counts[key]} />
            ))}
          </div>
          <Table caption={t("title")} columns={columns} rows={payload.students} getRowId={(row) => row.student_id} />
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? t("detailsFor", { name: selected.student_name || anonymous }) : t("details")}
      >
        {selected ? (
          <div className="flex flex-col gap-4 text-body-sm text-ink">
            <dl className="grid grid-cols-3 gap-3">
              {(
                [
                  ["browserSwitches", selected.browser_switch_count],
                  ["tabSwitches", selected.tab_switch_count],
                  ["redFlagPoints", selected.proctoring_summary.total_red_flag_points],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <dt className="text-caption text-ink-muted">{t(key)}</dt>
                  <dd className="text-body font-semibold">{format.number(value)}</dd>
                </div>
              ))}
            </dl>
            {selected.disqualification_reason ? (
              <p className="rounded-input bg-danger-soft p-3 text-danger">
                <span className="font-semibold">{t("disqualification")}:</span> {selected.disqualification_reason}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <h3 className="text-body font-semibold">{t("events")}</h3>
              {selected.proctoring_events.length ? (
                <ul className="flex max-h-64 flex-col gap-2 overflow-auto">
                  {selected.proctoring_events.map((event) => (
                    <li key={event.id} className="rounded-input border border-border p-2">
                      <p className="text-caption text-ink-muted">
                        {format.dateTime(event.timestamp)}
                        {event.points ? ` · +${format.number(event.points)}` : ""}
                      </p>
                      <p>{event.message || event.type}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted">{t("noEvents")}</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
};

export default ExamClassRosterPanel;
