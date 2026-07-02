import axiosReq from "@/lib/axios";
import { AxiosResponse } from "axios";

const GRADING_DETAILS_LIMIT = 6;

const fetchGradingSummary = async ({ examId, currentPage, search }: FetchGradingSummaryRequest) => {
  const params: GradingSummaryQuery = {
    page: currentPage,
    limit: GRADING_DETAILS_LIMIT,
  };

  if (search.trim()) {
    params.search = search.trim();
  }

  return axiosReq.get<GradingSummaryResponse, AxiosResponse<GradingSummaryResponse>>(
    `${process.env.NEXT_PUBLIC_BASE_URL}/exams/grading/${examId}`,
    {
      params,
    },
  );
};

export default fetchGradingSummary;
