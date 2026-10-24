"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { buttonClasses, FilterBar, PageHeader } from "@/design/ui";
import { setSearchInput } from "@/lib/features/classSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import CreateActionPlusIconSVG from "../svg/CreateActionPlusIconSVG";

interface ClassesNameSectionProps {
  role: RoleUserType | undefined;
}

/** The Classes page header: title, Create class (teachers) and the search box. */
const ClassesNameSection = ({ role }: ClassesNameSectionProps) => {
  const t = useTranslations("classes");
  const { searchInput } = useAppSelector((state) => state.class);
  const dispatch = useAppDispatch();
  const isTeacher = role === "TEACHER";

  return (
    <div className="mb-6 flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          isTeacher ? (
            <NextLink href="/classes/create" className={buttonClasses()}>
              <CreateActionPlusIconSVG className="size-4" />
              {t("create")}
            </NextLink>
          ) : undefined
        }
      />
      {isTeacher ? (
        <FilterBar
          search={searchInput}
          onSearchChange={(value) => dispatch(setSearchInput(value))}
          searchPlaceholder={t("search")}
        />
      ) : null}
    </div>
  );
};

export default ClassesNameSection;
