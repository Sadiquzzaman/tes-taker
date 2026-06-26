"use client";

import Image from "next/image";
import { RotatingLines } from "react-loader-spinner";
import useProfile from "@/hooks/api/auth/useProfile";
import ChangePasswordForm from "./ChangePasswordForm";
import AccountBilling from "./AccountBilling";

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
};

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-1 border-b border-[#E5E5E5] py-4 last:border-b-0">
    <p className="text-[13px] font-[400] leading-[16px] tracking-[-0.02em] text-[#747775]">{label}</p>
    <p className="text-[16px] font-[500] leading-[20px] tracking-[-0.02em] text-[#232A25] break-words">{value}</p>
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
        <p className="text-[16px] font-[500] text-[#232A25]">We couldn't load your profile.</p>
        <button
          onClick={() => void refetch()}
          className="px-4 h-10 flex items-center justify-center rounded-[8px] bg-[#49734F] text-white text-[14px] font-[500] tracking-[-0.02em]"
        >
          Try again
        </button>
      </div>
    );
  }

  const isVerified = profile.is_verified;

  return (
    <div className="w-full max-w-[800px] mx-auto py-8 flex flex-col gap-6">
      <p className="font-[600] text-[32px] leading-[32px] tracking-[-0.04em] text-[#232A25]">Account</p>

      <div className="rounded-2xl border border-[#E5E5E5] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#E5E5E5] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="relative h-16 w-16 overflow-hidden rounded-full bg-gray-200">
              <Image src="/assets/image/user.png" alt="User avatar" fill className="object-cover" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-[20px] font-[600] leading-[24px] tracking-[-0.02em] text-[#232A25]">
                {profile.full_name}
              </p>
              <p className="text-[14px] font-[400] leading-[18px] tracking-[-0.02em] text-[#747775]">
                {profile.email || profile.phone}
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full bg-[#EAF2EB] px-3 py-1 text-[13px] font-[500] capitalize tracking-[-0.02em] text-[#49734F]">
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
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-[500] ${
                  isVerified ? "bg-[#EAF2EB] text-[#49734F]" : "bg-[#FFF4E5] text-[#B54708]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isVerified ? "bg-[#49734F]" : "bg-[#B54708]"}`}
                />
                {isVerified ? "Verified" : "Unverified"}
              </span>
            }
          />
          <InfoRow label="Member since" value={formatDate(profile.created_at)} />
        </div>
      </div>

      {profile.role === "TEACHER" && <AccountBilling />}

      <ChangePasswordForm />
    </div>
  );
};

export default ProfileView;
