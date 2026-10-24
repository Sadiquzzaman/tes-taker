"use client";

import Image from "next/image";
import { Suspense } from "react";
import { RotatingLines } from "react-loader-spinner";
import useProfile from "@/hooks/api/auth/useProfile";
import ChangePasswordForm from "./ChangePasswordForm";
import AccountBilling from "./AccountBilling";
import TeacherRequestPanel from "./TeacherRequestPanel";

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
};

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-1 border-b border-border py-4 last:border-b-0">
    <p className="text-body-sm font-normal text-ink-muted">{label}</p>
    <p className="text-body font-medium text-ink break-words">{value}</p>
  </div>
);

const ProfileView = () => {
  const { profile, loading, error, refetch } = useProfile();

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <RotatingLines
          visible={true}
          height="48"
          width="48"
          color="#49734F"
          strokeWidth="5"
          animationDuration="0.75"
          ariaLabel="profile-loading"
        />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
        <p className="text-body font-medium text-ink">We couldn&apos;t load your profile.</p>
        <button
          onClick={() => void refetch()}
          className="px-4 h-10 flex items-center justify-center rounded-input bg-primary text-ink-inverse text-body-sm font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const isVerified = profile.is_verified;

  return (
    <div className="w-full max-w-[800px] mx-auto py-8 flex flex-col gap-6">
      <p className="font-semibold text-display tracking-tight text-ink">Account</p>

      <div className="rounded-2xl border border-border bg-surface">
        <div className="flex flex-col gap-4 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="relative h-16 w-16 overflow-hidden rounded-full bg-border">
              <Image src="/assets/image/user.png" alt="User avatar" fill className="object-cover" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-title-sm font-semibold text-ink">
                {profile.full_name}
              </p>
              <p className="text-body-sm font-normal text-ink-muted">
                {profile.email || profile.phone}
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full bg-primary-soft px-3 py-1 text-body-sm font-medium capitalize text-primary">
            {profile.role?.toLowerCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-x-10 px-6 py-2 sm:grid-cols-2">
          <InfoRow label="Full name" value={profile.full_name} />
          <InfoRow label="Role" value={<span className="capitalize">{profile.role?.toLowerCase()}</span>} />
          <InfoRow label="Email" value={profile.email || "Not provided"} />
          <InfoRow label="Phone" value={profile.phone || "Not provided"} />
          <InfoRow
            label="Account status"
            value={
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-body-sm font-medium ${
                  isVerified ? "bg-primary-soft text-primary" : "bg-warning-soft text-warning"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isVerified ? "bg-primary" : "bg-warning"}`} />
                {isVerified ? "Verified" : "Unverified"}
              </span>
            }
          />
          <InfoRow label="Member since" value={formatDate(profile.created_at)} />
        </div>
      </div>

      {profile.role === "STUDENT" && <TeacherRequestPanel />}

      {profile.role === "TEACHER" && (
        <Suspense fallback={<div className="rounded-2xl border border-border bg-surface p-6 animate-pulse h-40" />}>
          <AccountBilling />
        </Suspense>
      )}

      <ChangePasswordForm />
    </div>
  );
};

export default ProfileView;
