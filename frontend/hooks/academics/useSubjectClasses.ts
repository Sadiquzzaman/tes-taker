import { useEffect, useState } from "react";
import axiosReq from "@/lib/axios";

export interface SubjectClassesData {
  sections: ClassSection[];
  offerings: SubjectClass[];
}

const EMPTY: SubjectClassesData = { sections: [], offerings: [] };

/** The workspace's sections and subject classes in the default session (P2-03), for the test wizard. */
export default function useSubjectClasses(enabled = true): SubjectClassesData {
  const [data, setData] = useState<SubjectClassesData>(EMPTY);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void Promise.all([
      axiosReq.get<ApiResponse<ClassSection[]>>(`${baseUrl}/sections`),
      axiosReq.get<ApiResponse<SubjectClass[]>>(`${baseUrl}/offerings`),
    ])
      .then(([sections, offerings]) => {
        if (!cancelled) setData({ sections: sections.data?.payload ?? [], offerings: offerings.data?.payload ?? [] });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [baseUrl, enabled]);

  return data;
}

/** Classes the user teaches in: a teacher of one of their subject classes, or a section's class teacher. */
export const classesTaughtBy = (userId: string | undefined, { sections, offerings }: SubjectClassesData): Set<string> => {
  const classOfSection = new Map(sections.map((section) => [section.id, section.class_id]));
  const taught = new Set<string>();
  if (!userId) return taught;
  sections.filter((section) => section.class_teacher?.id === userId).forEach((section) => taught.add(section.class_id));
  offerings
    .filter((offering) => offering.teachers.some((teacher) => teacher.id === userId))
    .forEach((offering) => {
      const classId = classOfSection.get(offering.section_id);
      if (classId) taught.add(classId);
    });
  return taught;
};
