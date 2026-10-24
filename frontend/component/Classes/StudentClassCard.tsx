"use client";

import { useTranslations } from "next-intl";
import { IconButton } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { setOpenShareClassModal } from "@/lib/features/classSlice";
import { useAppDispatch } from "@/lib/hooks";
import ShareIconSVG from "../svg/ShareIconSVG";
import { ClassCardFrame } from "./ClassCard";

/** A class the student belongs to: name and when they joined. */
const StudentClassCard = ({ classItem, index }: ClassCardProps<StudentClass>) => {
  const t = useTranslations("classes");
  const format = useFormat();
  const dispatch = useAppDispatch();

  return (
    <ClassCardFrame
      index={index}
      name={classItem.class_name}
      href={`/classes/details/${classItem.id}`}
      meta={classItem.joined_at ? t("joinedOn", { date: format.date(classItem.joined_at) }) : null}
      actions={
        <IconButton size="sm" label={t("share")} icon={<ShareIconSVG width={16} />} onClick={() => dispatch(setOpenShareClassModal(classItem))} />
      }
    />
  );
};

export default StudentClassCard;
