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
          <p className="text-title font-semibold tracking-tight text-ink">No grading found</p>
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
              className="flex h-8 w-8 items-center justify-center rounded-input bg-surface p-2 text-ink disabled:opacity-50"
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
                    className={`flex h-8 w-8 items-center justify-center rounded-input border px-2 py-2 text-body-sm font-normal leading-4 ${
                      page === pageNumber
                        ? "border-ink bg-surface text-ink"
                        : "border-border bg-surface text-ink-muted"
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
                    className="flex h-8 w-8 items-center justify-center rounded-input bg-surface px-2 py-2 text-body-sm font-normal leading-4 text-ink-muted"
                  >
                    ...
                  </span>
                );
              }

              return null;
            })}

            <button
              className="flex h-8 w-8 items-center justify-center rounded-input bg-surface p-2 text-ink disabled:opacity-50"
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
