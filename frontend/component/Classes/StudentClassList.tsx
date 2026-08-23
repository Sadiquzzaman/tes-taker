"use client";

import useWorkspace from "@/hooks/organization/useWorkspace";
import useGetStudentClassList from "@/hooks/api/class/useGetStudentClassList";
import StudentClassCard from "./StudentClassCard";

const StudentClassList = () => {
  const { workspace } = useWorkspace({ loadOrganizations: true });
  const { classList, loading } = useGetStudentClassList();

  const workspaceLabel =
    workspace.type === "organization"
      ? workspace.name || "Organization"
      : workspace.type === "individual_teacher"
        ? workspace.name || "Teacher workspace"
        : "Current workspace";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-[#747775]">Showing classes for `{workspaceLabel}`.</p>

      {loading ? (
        <p className="text-[14px] text-[#747775]">Loading classes...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-4">
          {classList.map((classItem, index) => (
            <StudentClassCard key={classItem.id} classItem={classItem} index={index} />
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentClassList;
