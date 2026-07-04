import axiosReq from "@/lib/axios";
import { AxiosResponse } from "axios";

const GRADING_EXPORT_PAGE_LIMIT = 50;

export interface FetchAllGradingSubmissionsResult {
  exam: GradingExamSummary;
  submissions: GradingSubmissionListItem[];
}

export const fetchAllGradingSubmissions = async (examId: string): Promise<FetchAllGradingSubmissionsResult> => {
  let page = 1;
  let exam: GradingExamSummary | null = null;
  const submissions: GradingSubmissionListItem[] = [];

  while (true) {
    const response = await axiosReq.get<GradingSummaryResponse, AxiosResponse<GradingSummaryResponse>>(
      `${process.env.NEXT_PUBLIC_BASE_URL}/exams/grading/${examId}`,
      {
        params: {
          page,
          limit: GRADING_EXPORT_PAGE_LIMIT,
        },
      },
    );

    if (response.status !== 200) {
      break;
    }

    exam = response.data.payload.exam;
    submissions.push(...response.data.payload.submissions);

    const totalPages = response.data.meta.total_pages;
    if (page >= totalPages) {
      break;
    }

    page += 1;
  }

  if (!exam) {
    throw new Error("Exam not found");
  }

  return { exam, submissions };
};
