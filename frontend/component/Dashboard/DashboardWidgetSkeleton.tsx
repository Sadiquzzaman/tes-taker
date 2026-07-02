import React from "react";

type DashboardWidgetSkeletonProps = {
  className?: string;
  lines?: number;
};

const DashboardWidgetSkeleton = ({ className = "", lines = 3 }: DashboardWidgetSkeletonProps) => (
  <div className={`animate-pulse ${className}`}>
    <div className="h-4 bg-[#EFF0F3] rounded w-1/3 mb-4" />
    {Array.from({ length: lines }).map((_, index) => (
      <div key={index} className="h-3 bg-[#EFF0F3] rounded w-full mb-2" />
    ))}
  </div>
);

export default DashboardWidgetSkeleton;
