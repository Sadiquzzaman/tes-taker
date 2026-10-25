"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { buttonClasses, Card, EmptyState, Tabs } from "@/design/ui";
import useWorkspace from "@/hooks/organization/useWorkspace";
import FileIconSVG from "../svg/FileIconSVG";
import TestCard from "./TestCard";

const FILTERS = ["all", "ongoing", "pending", "completed"] as const;

/** A class's tests, filtered by state (live, waiting for marking, completed). */
const ClassTests = ({ testList, role }: { testList: TestListItem[]; role: RoleUserType | undefined }) => {
  const t = useTranslations("classes.tests");
  const tc = useTranslations("dashboard");
  const { memberRole, isIndividual } = useWorkspace();
  const canCreateTest = role === "TEACHER" && (isIndividual || (memberRole !== "ASSISTANT" && memberRole !== "STUDENT"));

  const listFor = (filter: (typeof FILTERS)[number]) => {
    const tests = filter === "all" ? testList : testList.filter((test) => test.status === filter);
    if (!tests.length) {
      return <EmptyState title={t("empty")} description={t("emptyDetail")} />;
    }
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {tests.map((test) => (
          <TestCard key={test.id} testData={test} role={role} />
        ))}
      </div>
    );
  };

  return (
    <Card
      title={t("title")}
      actions={
        canCreateTest ? (
          <NextLink href="/tests/create" className={buttonClasses({ size: "sm" })}>
            <FileIconSVG width={16} />
            {tc("createTest")}
          </NextLink>
        ) : undefined
      }
    >
      <Tabs tabs={FILTERS.map((filter) => ({ key: filter, label: t(filter), content: listFor(filter) }))} />
    </Card>
  );
};

export default ClassTests;
