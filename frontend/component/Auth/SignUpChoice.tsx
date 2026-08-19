"use client";

import Link from "next/link";

const SignUpChoice = ({
  onSelectStudent,
  onSelectTeacher,
}: {
  onSelectStudent: () => void;
  onSelectTeacher: () => void;
}) => {
  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-8">
      <div className="flex flex-row justify-between items-center mb-2">
        <h2 className="text-[32px] font-semibold text-[#0F1A12] leading-[39px] tracking-[-0.02em] capitalize">
          Sign Up
        </h2>
      </div>

      <p className="text-[#747775] text-[16px] leading-[20px] -mt-4">
        Choose how you want to join TestTaker.
      </p>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onSelectStudent}
          className="w-full text-left rounded-lg border border-[#E5E5E5] px-4 py-4 hover:border-[#49734F] transition"
        >
          <p className="text-[18px] font-semibold text-[#232A25]">Student</p>
          <p className="mt-1 text-[14px] text-[#747775]">
            Create a student account to join classes and take tests.
          </p>
        </button>

        <button
          type="button"
          onClick={onSelectTeacher}
          className="w-full text-left rounded-lg border border-[#E5E5E5] px-4 py-4 hover:border-[#49734F] transition"
        >
          <p className="text-[18px] font-semibold text-[#232A25]">Sign Up as Teacher</p>
          <p className="mt-1 text-[14px] text-[#747775]">
            Create an account and request teacher access. An admin must approve before you can teach.
          </p>
        </button>

        <Link
          href="/signup/organization"
          className="w-full text-left rounded-lg border border-[#E5E5E5] px-4 py-4 hover:border-[#49734F] transition"
        >
          <p className="text-[18px] font-semibold text-[#232A25]">Organization</p>
          <p className="mt-1 text-[14px] text-[#747775]">
            Register a school or organization. An admin will approve before you can use it.
          </p>
        </Link>
      </div>
    </div>
  );
};

export default SignUpChoice;
