"use client";

import { useTranslations } from "next-intl";
import useApiData from "@/component/Homework/useApiData";
import SimilarityReport from "./SimilarityReport";

/** A homework's plagiarism results, titled with the homework. */
const HomeworkSimilarity = ({ homeworkId }: { homeworkId: string }) => {
  const t = useTranslations("plagiarism");
  const { data } = useApiData<{ title: string }>(`/homework/${homeworkId}`);
  return <SimilarityReport scopeType="HOMEWORK" scopeId={homeworkId} title={data?.title} back={{ href: `/homework/${homeworkId}`, label: t("backToHomework") }} />;
};

export default HomeworkSimilarity;
