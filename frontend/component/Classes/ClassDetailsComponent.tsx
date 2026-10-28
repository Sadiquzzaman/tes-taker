"use client";

import { useTranslations } from "next-intl";
import { Breadcrumb, Button, Card, EmptyState, PageHeader, Skeleton, Tabs } from "@/design/ui";
import useClassDetails from "@/hooks/classes/useClassDetails";
import useWorkspace from "@/hooks/organization/useWorkspace";
import ShareIconSVG from "../svg/ShareIconSVG";
import ClassDiscussions from "./ClassDiscussions";
import ClassStudent from "./ClassStudent";
import ClassSubjectsPanel from "./ClassSubjectsPanel";
import ClassTests from "./ClassTests";
import ShareClassModal from "./ShareClassModal";

/** A class: its students, tests, discussions and (organisation classes) subjects, as tabs. */
const ClassDetailsComponent = ({ classId, role }: { classId: string; role: RoleUserType | undefined }) => {
  const t = useTranslations("classes");
  const { loading, classData, fetch, apiComplete, testList, handleShareClass } = useClassDetails(classId, role);
  const { isIndividual } = useWorkspace();
  const isTeacher = role === "TEACHER";
  // Every class has an organisation now (a solo teacher's is a SOLO one); only school classes have subjects to manage.
  const isOrgClass = classData?.class_kind === "ORGANIZATION";
  const classesHref = isIndividual ? "/classes" : "/organization/classes";
  const breadcrumb = (name?: string) => (
    <Breadcrumb items={[{ label: t("title"), href: classesHref }, { label: name || t("details") }]} />
  );

  if (loading || !apiComplete) {
    return (
      <div className="flex flex-col gap-6 pb-8" aria-busy="true">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-10 w-2/3" />
        <Card>
          <Skeleton lines={6} />
        </Card>
      </div>
    );
  }

  if (classData === null) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        {breadcrumb()}
        <Card>
          <EmptyState title={t("notFound")} description={t("notFoundDetail")} />
        </Card>
      </div>
    );
  }

  const tabs = [
    {
      key: "students",
      label: t("tabs.students"),
      content: <ClassStudent classId={classId} student={classData?.classStudents || []} fetch={fetch} role={role} />,
    },
    { key: "tests", label: t("tabs.tests"), content: <ClassTests testList={testList} role={role} /> },
    {
      key: "discussions",
      label: t("tabs.discussions"),
      content: (
        <ClassDiscussions
          classId={classId}
          className={classData?.class_name || ""}
          role={role}
          classStudents={classData?.classStudents || []}
        />
      ),
    },
    ...(isOrgClass && isTeacher
      ? [{ key: "subjects", label: t("tabs.subjects"), content: <ClassSubjectsPanel classId={classId} /> }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        breadcrumb={breadcrumb(classData?.class_name)}
        title={classData?.class_name || t("details")}
        actions={
          isTeacher ? (
            <Button variant="secondary" leftIcon={<ShareIconSVG width={16} />} onClick={handleShareClass}>
              {t("share")}
            </Button>
          ) : undefined
        }
      />
      <Tabs tabs={tabs} />
      <ShareClassModal />
    </div>
  );
};

export default ClassDetailsComponent;
