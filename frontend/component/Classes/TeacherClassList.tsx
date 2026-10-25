"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { buttonClasses, Card, EmptyState } from "@/design/ui";
import useClassList from "@/hooks/classes/useClassList";
import { useAppSelector } from "@/lib/hooks";
import AddStudentModal from "./AddStudentModal";
import ClassCard from "./ClassCard";
import ClassGridSkeleton, { CLASS_GRID } from "./ClassGridSkeleton";

/** The teacher's classes, filtered by the search box above. */
const TeacherClassList = () => {
  const t = useTranslations("classes");
  const { fetch, loading, filteredClassList } = useClassList();
  const searching = Boolean(useAppSelector((state) => state.class.searchInput));

  return (
    <>
      {loading ? (
        <ClassGridSkeleton />
      ) : filteredClassList.length === 0 ? (
        <Card>
          <EmptyState
            title={searching ? t("noMatch") : t("empty")}
            description={searching ? undefined : t("emptyTeacher")}
            action={
              searching ? undefined : (
                <NextLink href="/classes/create" className={buttonClasses()}>
                  {t("create")}
                </NextLink>
              )
            }
          />
        </Card>
      ) : (
        <div className={CLASS_GRID}>
          {filteredClassList.map((classItem, index) => (
            <ClassCard key={classItem.id} classItem={classItem} index={index} />
          ))}
        </div>
      )}
      <AddStudentModal fetchClassDetails={fetch} />
    </>
  );
};

export default TeacherClassList;
