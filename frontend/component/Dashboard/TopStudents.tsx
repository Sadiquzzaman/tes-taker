"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Card, EmptyState, FilterBar, Select, Table, type TableColumn } from "@/design/ui";
import { useDashboard } from "@/context/DashboardContext";
import useFormat from "@/i18n/useFormat";

const ROWS_SHOWN = 10;

/** The best average scores in one class at a time, searchable and sortable. */
const TopStudents = () => {
  const t = useTranslations("dashboard");
  const format = useFormat();
  const { data, loading } = useDashboard();
  const classes = data?.top_students_by_class ?? [];
  const [chosenClassId, setChosenClassId] = useState("");
  const [search, setSearch] = useState("");

  const selectedClass = classes.find((item) => item.class_id === chosenClassId) ?? classes[0];
  const students = selectedClass?.students ?? [];

  const needle = search.trim().toLocaleLowerCase();
  const matching = needle ? students.filter((student) => student.name.toLocaleLowerCase().includes(needle)) : students;
  // Best average first, so the 10 shown are the top 10.
  const filtered = [...matching].sort((a, b) => (b.avg_score_percent ?? -1) - (a.avg_score_percent ?? -1));

  const columns: TableColumn<DashboardTopStudent>[] = [
    { key: "name", header: t("top.student"), cell: (row) => row.name, sortValue: (row) => row.name },
    {
      key: "tests",
      header: t("top.tests"),
      cell: (row) => format.number(row.tests_taken),
      sortValue: (row) => row.tests_taken,
      align: "right",
    },
    {
      key: "avg",
      header: t("top.avgScore"),
      cell: (row) => (row.avg_score_percent == null ? "—" : format.number(Math.round(row.avg_score_percent) / 100, { style: "percent" })),
      sortValue: (row) => row.avg_score_percent,
      align: "right",
    },
  ];

  const hidden = Math.max(0, filtered.length - ROWS_SHOWN);

  return (
    <Card title={t("top.title")} className="h-full">
      {!loading && students.length === 0 ? (
        <EmptyState className="py-4" title={t("top.empty")} description={t("top.emptyDetail")} />
      ) : (
        <div className="flex flex-col gap-3">
          <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder={t("top.search")}>
            {classes.length > 1 ? (
              <Select
                label={t("top.class")}
                hideLabel
                placeholder={false}
                value={selectedClass?.class_id ?? ""}
                onChange={(event) => {
                  setChosenClassId(event.target.value);
                  setSearch("");
                }}
                options={classes.map((item) => ({ value: item.class_id, label: item.class_name }))}
                fieldClassName="sm:w-48"
              />
            ) : null}
          </FilterBar>
          <Table
            caption={t("top.caption", { className: selectedClass?.class_name ?? "" })}
            columns={columns}
            rows={filtered.slice(0, ROWS_SHOWN)}
            getRowId={(row) => row.student_id}
            loading={loading}
            defaultSort={{ key: "avg", direction: "desc" }}
            empty={<EmptyState className="py-4" title={t("top.noMatch")} />}
          />
          {hidden > 0 ? <p className="text-center text-body-sm text-ink-muted">{t("top.more", { count: hidden })}</p> : null}
        </div>
      )}
    </Card>
  );
};

export default TopStudents;
