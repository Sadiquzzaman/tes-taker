"use client";

import { setPage } from "@/lib/features/gradingSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import GradeCard from "./GradeCard";
import { RotatingLines } from "react-loader-spinner";
import useGetGradeList from "@/hooks/api/grading/useGetGradeList";
import PaginationChevronLeftIconSVG from "../svg/PaginationChevronLeftIconSVG";
import PaginationChevronRightIconSVG from "../svg/PaginationChevronRightIconSVG";

const GradeList = () => {
  const dispatch = useAppDispatch();
  const { page } = useAppSelector((state) => state.grade);
  const { apiComplete, gradeList, loading, meta } = useGetGradeList();
  const totalPages = meta?.total_pages ?? 1;

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) {
      return;
    }

    dispatch(setPage(nextPage));
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-300px)] w-full items-center justify-center">
        <RotatingLines
          visible={true}
          height="48"
          width="48"
          color="grey"
          strokeWidth="5"
          animationDuration="0.75"
          ariaLabel="rotating-lines-loading"
          wrapperStyle={{}}
          wrapperClass=""
        />
      </div>
    );
  }

  if (!apiComplete) {
    return null;
  }

  if (gradeList.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-400px)] w-full items-center justify-center">
        <div className="text-center">
          <p className="text-[24px] font-[600] leading-[32px] tracking-[-0.04em] text-[#232A25]">No grading found</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
        {gradeList.map((gradeItem) => (
          <GradeCard key={gradeItem.id} gradeItem={gradeItem} />
        ))}
      </div>

      {meta && totalPages > 1 && (
        <div className="mt-8 flex h-8 w-full items-center justify-center gap-6">
          <div className="flex h-8 w-[272px] items-center justify-center gap-2 opacity-80">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-white p-2 text-[#232A25] disabled:opacity-50"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            >
              <PaginationChevronLeftIconSVG width={16} />
            </button>

            {Array.from({ length: totalPages }).map((_, index) => {
              const pageNumber = index + 1;
              const shouldShowPage = index === 0 || index === totalPages - 1 || Math.abs(pageNumber - page) <= 1;
              const shouldShowEllipsis =
                (index === 1 && page > 3) || (index === totalPages - 2 && page < totalPages - 2);

              if (shouldShowPage) {
                return (
                  <button
                    key={pageNumber}
                    className={`flex h-8 w-8 items-center justify-center rounded-[6px] border px-2 py-2 text-[14px] font-[400] leading-4 tracking-[-0.02em] ${
                      page === pageNumber
                        ? "border-[#232A25] bg-white text-[#232A25]"
                        : "border-[#E5E5E5] bg-white text-[#747775]"
                    }`}
                    onClick={() => handlePageChange(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                );
              }

              if (shouldShowEllipsis) {
                return (
                  <span
                    key={`ellipsis-${pageNumber}`}
                    className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-white px-2 py-2 text-[14px] font-[400] leading-4 tracking-[-0.02em] text-[#747775]"
                  >
                    ...
                  </span>
                );
              }

              return null;
            })}

            <button
              className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-white p-2 text-[#232A25] disabled:opacity-50"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
            >
              <PaginationChevronRightIconSVG width={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default GradeList;
