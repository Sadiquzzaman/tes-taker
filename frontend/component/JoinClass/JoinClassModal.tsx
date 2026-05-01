"use client";

import { useRouter } from "next/navigation";

const InviteIcon = ({ width = 40 }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M28.3333 5C29.6087 4.99993 30.8358 5.48721 31.7637 6.36214C32.6917 7.23707 33.2502 8.43351 33.325 9.70667L33.3333 10V17.25L34.3233 16.81C35.3466 16.355 36.5266 17.06 36.6566 18.14L36.6666 18.3333V31.6667C36.6669 32.5076 36.3493 33.3176 35.7775 33.9342C35.2057 34.5509 34.4219 34.9286 33.5833 34.9917L33.3333 35H6.66665C5.82569 35.0003 5.0157 34.6827 4.39907 34.1108C3.78243 33.539 3.40472 32.7553 3.34165 31.9167L3.33331 31.6667V18.3333C3.33331 17.2133 4.45831 16.4217 5.49498 16.7417L5.67831 16.81L6.66665 17.25V10C6.66658 8.72465 7.15386 7.49748 8.02879 6.56957C8.90372 5.64166 10.1002 5.08315 11.3733 5.00833L11.6666 5H28.3333ZM28.3333 8.33333H11.6666C11.2246 8.33333 10.8007 8.50893 10.4881 8.82149C10.1756 9.13405 9.99998 9.55797 9.99998 10V18.7317L20 23.1767L30 18.7317V10C30 9.55797 29.8244 9.13405 29.5118 8.82149C29.1993 8.50893 28.7753 8.33333 28.3333 8.33333ZM20 13.3333C20.4248 13.3338 20.8334 13.4965 21.1423 13.7881C21.4512 14.0797 21.637 14.4783 21.6619 14.9023C21.6868 15.3264 21.5489 15.744 21.2762 16.0697C21.0036 16.3955 20.6168 16.6048 20.195 16.655L20 16.6667H16.6666C16.2418 16.6662 15.8333 16.5035 15.5244 16.2119C15.2155 15.9203 15.0296 15.5217 15.0047 15.0977C14.9798 14.6736 15.1178 14.256 15.3904 13.9303C15.6631 13.6045 16.0498 13.3952 16.4716 13.345L16.6666 13.3333H20Z"
        fill="currentColor"
      />
    </svg>
  );
};

const JoinClassModal = ({ classData, classId, apiResponse, errorMessage }: JoinClassModalProps) => {
  const router = useRouter();
  const isError = Boolean(errorMessage);
  const title = isError
    ? "Class unavailable"
    : `Join '${classData?.class_name ?? ""}' class by ${classData?.created_user_name ?? ""}`;
  const description = isError ? errorMessage : classData?.description || "No description available for this class.";

  const handleContinue = () => {
    if (!apiResponse) {
      return;
    }

    sessionStorage.setItem(
      "joinSessionInfo",
      JSON.stringify({
        id: classId,
        className: apiResponse?.payload?.class_name,
        ...apiResponse?.payload,
        joinType: "class",
      }),
    );

    router.push("/login");
  };

  return (
    <div className="flex w-full items-center justify-center font-ins-sans">
      <div className="flex w-full max-w-[460px] flex-col justify-center rounded-xl border-l border-l-[#E5E5E5] bg-white shadow-lg max-md:max-w-full">
        <div className="flex flex-col items-start justify-center gap-6 p-6">
          <div className={isError ? "text-[#B93815]" : "text-[#49734F]"}>
            <InviteIcon width={40} />
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <p className="w-full text-[24px] font-medium leading-[29px] tracking-[-0.02em] text-[#232A25]">{title}</p>
            <p
              className={
                isError
                  ? "w-full text-[16px] font-normal leading-5 tracking-[-0.02em] text-[#B93815]"
                  : "w-full text-[16px] font-normal leading-5 tracking-[-0.02em] text-[#747775]"
              }
            >
              {description}
            </p>
          </div>
        </div>

        {!isError ? (
          <>
            <div className="h-px w-full bg-[#E5E5E5]" />

            <div className="flex items-center justify-end p-6">
              <button
                type="button"
                onClick={handleContinue}
                className="flex h-10 items-center justify-center rounded-lg bg-[#49734F] px-4 pl-[14px] text-[14px] font-medium leading-4 tracking-[-0.02em] text-white transition-colors hover:bg-[#3f6244]"
              >
                Continue
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default JoinClassModal;
