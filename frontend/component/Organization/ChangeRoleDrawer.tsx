"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Drawer, Select } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import axiosReq from "@/lib/axios";

/** Staff roles an owner or admin can give on the Teachers screen (P12-01: branch manager needs a branch). */
const STAFF_ROLES: OrganizationMemberRole[] = ["ADMIN", "TEACHER", "BRANCH_MANAGER"];

type BranchOption = { id: string; name: string | null; is_default: boolean };

/** Change a staff member's role; a branch manager also gets the branch they run (FND-06). */
const ChangeRoleDrawer = ({
  organizationId,
  member,
  onClose,
  onChanged,
}: {
  organizationId: string;
  member: OrganizationMemberItem | null;
  onClose: () => void;
  onChanged: () => void;
}) => {
  const t = useTranslations("organization.members.changeRole");
  const tOrg = useTranslations("organization");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [role, setRole] = useState<OrganizationMemberRole>("TEACHER");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<BranchOption[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!member) return;
    setRole(member.role);
    setBranchId(member.branch_id ?? "");
  }, [member]);

  useEffect(() => {
    if (!member || role !== "BRANCH_MANAGER" || branches) return;
    axiosReq
      .get<{ payload: BranchOption[] }>(`${baseUrl}/attendance/branches`)
      .then((res) => setBranches(res.data?.payload ?? []))
      .catch(() => setBranches([]));
  }, [baseUrl, branches, member, role]);

  const save = async () => {
    if (!member) return;
    setSaving(true);
    try {
      await axiosReq.patch(`${baseUrl}/organizations/${organizationId}/members/${member.id}`, {
        role,
        ...(role === "BRANCH_MANAGER" ? { branch_id: branchId } : {}),
      });
      triggerToast({ title: t("doneTitle"), description: t("done", { role: tOrg(`roles.${role}`) }), type: "success" });
      onChanged();
      onClose();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setSaving(false);
    }
  };

  const branchName = (branch: BranchOption) => branch.name || t("mainBranch");
  const needsBranch = role === "BRANCH_MANAGER";

  return (
    <Drawer
      open={member !== null}
      onClose={onClose}
      title={t("title", { name: member?.user.full_name || member?.user.phone || "" })}
      description={t("intro")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={saving} disabled={needsBranch && !branchId} onClick={() => void save()}>
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label={t("role")}
          value={role}
          placeholder={false}
          options={STAFF_ROLES.map((value) => ({ value, label: tOrg(`roles.${value}`) }))}
          onChange={(event) => setRole(event.target.value as OrganizationMemberRole)}
        />
        {needsBranch ? (
          <>
            <Select
              label={t("branch")}
              value={branchId}
              placeholder={t("chooseBranch")}
              options={(branches ?? []).map((branch) => ({ value: branch.id, label: branchName(branch) }))}
              onChange={(event) => setBranchId(event.target.value)}
            />
            <p className="text-body-sm text-ink-muted">{t("branchManagerHint")}</p>
          </>
        ) : null}
      </div>
    </Drawer>
  );
};

export default ChangeRoleDrawer;
