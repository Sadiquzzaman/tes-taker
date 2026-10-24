"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Avatar, Badge, Card, ErrorState, PageHeader, Skeleton, StatusPill } from "@/design/ui";
import useProfile from "@/hooks/api/auth/useProfile";
import useFormat from "@/i18n/useFormat";
import AccountBilling from "./AccountBilling";
import ChangePasswordForm from "./ChangePasswordForm";
import TeacherRequestPanel from "./TeacherRequestPanel";

const InfoRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
    <dt className="text-body-sm text-ink-muted">{label}</dt>
    <dd className="break-words text-body font-medium text-ink">{value}</dd>
  </div>
);

/** The signed-in user's profile, teacher request or billing, and password. */
const ProfileView = () => {
  const t = useTranslations("account");
  const format = useFormat();
  const { profile, loading, error, refetch } = useProfile();

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-8" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Card>
          <Skeleton lines={5} />
        </Card>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto w-full max-w-3xl py-8">
        <ErrorState title={t("loadFailed")} onRetry={() => void refetch()} />
      </div>
    );
  }

  const roleLabel = t.has(`roles.${profile.role}`) ? t(`roles.${profile.role}` as "roles.STUDENT") : profile.role;
  const createdAt = profile.created_at ? new Date(profile.created_at) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
      <PageHeader title={t("title")} />

      <Card flush>
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={profile.full_name} size="lg" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate text-title-sm font-semibold text-ink">{profile.full_name}</p>
              <p className="truncate text-body-sm text-ink-muted">{profile.email || profile.phone}</p>
            </div>
          </div>
          <Badge tone="primary" className="self-start sm:self-center">
            {roleLabel}
          </Badge>
        </div>
        <dl className="grid grid-cols-1 gap-x-10 px-4 py-2 sm:grid-cols-2 sm:px-6">
          <InfoRow label={t("fullName")} value={profile.full_name} />
          <InfoRow label={t("role")} value={roleLabel} />
          <InfoRow label={t("email")} value={profile.email || t("notProvided")} />
          <InfoRow label={t("phone")} value={profile.phone || t("notProvided")} />
          <InfoRow
            label={t("status")}
            value={
              <StatusPill tone={profile.is_verified ? "success" : "warning"}>{profile.is_verified ? t("verified") : t("unverified")}</StatusPill>
            }
          />
          <InfoRow
            label={t("memberSince")}
            value={createdAt && !Number.isNaN(createdAt.getTime()) ? format.date(createdAt, { day: "numeric", month: "long", year: "numeric" }) : "—"}
          />
        </dl>
      </Card>

      {profile.role === "STUDENT" ? <TeacherRequestPanel /> : null}

      {profile.role === "TEACHER" ? (
        <Suspense fallback={<Skeleton className="h-40 rounded-card" />}>
          <AccountBilling />
        </Suspense>
      ) : null}

      <ChangePasswordForm />
    </div>
  );
};

export default ProfileView;
