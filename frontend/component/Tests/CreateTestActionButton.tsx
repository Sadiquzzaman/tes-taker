"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, buttonClasses, Tooltip } from "@/design/ui";
import useEntitlements from "@/hooks/api/subscription/useEntitlements";
import useWorkspace from "@/hooks/organization/useWorkspace";
import CreateActionPlusIconSVG from "../svg/CreateActionPlusIconSVG";
import UpgradeLink from "@/component/Subscription/UpgradeLink";

/** "Create test" for teachers and owners; disabled with an upgrade hint once the plan's exam limit is reached. */
const CreateTestActionButton = () => {
  const t = useTranslations("dashboard");
  const { isExamLimitReached, loading } = useEntitlements();
  const { isIndividual, memberRole } = useWorkspace();

  // Match ClassTests: hide for org assistants/students; show for individual + org teachers/owners.
  const canCreateTest = isIndividual || (memberRole !== "ASSISTANT" && memberRole !== "STUDENT");

  if (!canCreateTest) {
    return null;
  }

  const icon = <CreateActionPlusIconSVG className="size-4" />;

  if (loading || isExamLimitReached) {
    const button = (
      <Button leftIcon={icon} disabled>
        {t("createTest")}
      </Button>
    );
    if (!isExamLimitReached) {
      return button;
    }
    return (
      <Tooltip
        placement="bottom"
        content={
          <span>
            {t("examLimitReached")}{" "}
            <UpgradeLink />
          </span>
        }
      >
        <span className="inline-flex">{button}</span>
      </Tooltip>
    );
  }

  return (
    <Link href="/tests/create" className={buttonClasses()}>
      {icon}
      {t("createTest")}
    </Link>
  );
};

export default CreateTestActionButton;
