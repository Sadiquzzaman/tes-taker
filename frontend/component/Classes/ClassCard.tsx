"use client";

import Image from "next/image";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { buttonClasses, IconButton } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { setOpenAddStudentModal, setOpenShareClassModal } from "@/lib/features/classSlice";
import { useAppDispatch } from "@/lib/hooks";
import ClassStudentCardIconSVG from "../svg/ClassStudentCardIconSVG";
import ClassTestsTakenIconSVG from "../svg/ClassTestsTakenIconSVG";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import ShareIconSVG from "../svg/ShareIconSVG";

const COVERS = [
  "/assets/image/classImage/class_default.png",
  "/assets/image/classImage/class_default_2.png",
  "/assets/image/classImage/class_default_3.png",
  "/assets/image/classImage/class_default_4.png",
  "/assets/image/classImage/class_default_5.png",
];

/** The shared layout of a class card (teacher and student versions). */
export const ClassCardFrame = ({
  index,
  name,
  meta,
  stats,
  actions,
  href,
}: {
  index: number;
  name: string;
  meta: ReactNode;
  stats?: Array<{ key: string; icon: ReactNode; label: string; value: string }>;
  actions?: ReactNode;
  href: string;
}) => {
  const t = useTranslations("classes");

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <div className="relative h-32 w-full">
        <Image src={COVERS[index % COVERS.length]} alt={t("imageAlt")} fill className="object-cover" sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h2 className="truncate text-body font-semibold text-ink">{name}</h2>
        <p className="text-caption text-ink-muted">{meta}</p>
        {stats?.length ? (
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <div key={stat.key} className="flex items-start gap-2">
                <span className="mt-0.5 text-ink-muted">{stat.icon}</span>
                <div>
                  <dt className="text-caption text-ink-muted">{stat.label}</dt>
                  <dd className="text-body font-semibold text-ink">{stat.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <div className="flex items-center gap-1">{actions}</div>
        <NextLink href={href} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          {t("view")}
        </NextLink>
      </div>
    </article>
  );
};

/** A teacher's class: name, last test, students and tests taken; add students or share. */
const ClassCard = ({ classItem, index }: ClassCardProps<Class>) => {
  const t = useTranslations("classes");
  const format = useFormat();
  const dispatch = useAppDispatch();

  return (
    <ClassCardFrame
      index={index}
      name={classItem.class_name}
      href={`/classes/details/${classItem.id}`}
      meta={
        classItem.last_test_taken_date ? t("lastTest", { date: format.dateTime(classItem.last_test_taken_date) }) : t("noTestYet")
      }
      stats={[
        {
          key: "students",
          icon: <ClassStudentCardIconSVG width={16} />,
          label: t("students"),
          value: format.number(classItem.classStudents.length),
        },
        {
          key: "tests",
          icon: <ClassTestsTakenIconSVG width={16} />,
          label: t("testsTaken"),
          value: format.number(classItem.total_test_taken ?? 0),
        },
      ]}
      actions={
        <>
          <IconButton size="sm" label={t("addStudents")} icon={<HumanAddIconSVG width={16} />} onClick={() => dispatch(setOpenAddStudentModal(classItem))} />
          <IconButton size="sm" label={t("share")} icon={<ShareIconSVG width={16} />} onClick={() => dispatch(setOpenShareClassModal(classItem))} />
        </>
      }
    />
  );
};

export default ClassCard;
