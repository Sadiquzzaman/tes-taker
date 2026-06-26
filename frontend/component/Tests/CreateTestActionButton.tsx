"use client";

import Link from "next/link";
import Tooltip from "@/Ui/Tooltip";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import CreateActionPlusIconSVG from "../svg/CreateActionPlusIconSVG";

const CreateTestActionButton = () => {
  const { isExamLimitReached, loading } = useEntitlements();

  const button = (
    <button
      type="button"
      disabled={loading || isExamLimitReached}
      className="flex items-center justify-center gap-2 w-[108px] sm:w-[128px] h-[32px] sm:h-[40px] bg-[#232A25] rounded-xl font-[500] text-white font-medium text-[12px] sm:text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <CreateActionPlusIconSVG className="size-4 text-white" />
      <span className="capitalize mb-[2px]">Create Test</span>
    </button>
  );

  if (isExamLimitReached) {
    return (
      <Tooltip
        placement="bottom"
        content={
          <span>
            You&apos;ve reached your exam limit. Please upgrade.{" "}
            <Link href="/billing" className="underline text-[#49734F]">
              Upgrade
            </Link>
          </span>
        }
      >
        <span className="inline-flex">{button}</span>
      </Tooltip>
    );
  }

  return <Link href="/tests/create">{button}</Link>;
};

export default CreateTestActionButton;
