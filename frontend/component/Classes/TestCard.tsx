import CalenderIconSVG from "../svg/CalenderIconSVG";

const TestCard = () => {
  return (
    <div className="w-full p-2 sm:p-4 flex flex-col items-center gap-6 bg-[rgba(239,240,243,0.75)] rounded-lg">
      <div className="w-full flex justify-between items-center">
        <h2 className="text-[18px] font-[500] leading-[100%] tracking-[-0.02em] text-[#49734F]">
          Algebra Midterm Assessment
        </h2>
        <span className="px-2 py-1 text-[12px] font-[500] leading-[12px] tracking-[-0.02em] text-[#49734F] bg-[rgba(0,233,33,0.15)] border border-[rgba(0,233,33,0.15)] rounded-[27px] box-border">
          Ongoing
        </span>
      </div>
      <div className="w-full flex items center justify-between">
        <div className="w-[33%]">
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Subject</p>
          <p className="font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25] pt-2">English</p>
        </div>
        <div className="w-[33%]">
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Participants</p>
          <p className="font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25] pt-2">28</p>
        </div>
        <div className="w-[33%]">
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Submitted</p>
          <p className="font-[600] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25] pt-2">09</p>
        </div>
      </div>
      <div className="w-full flex flex-col gap-4">
        <div className="w-full flex items center justify-between">
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">Submission progress</p>
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775]">09/28</p>
        </div>
        <div className="w-full h-1 rounded-[23px] bg-[#E5E5E5]">
          <div className={`h-full bg-[#49734F] rounded-[23px]`} style={{ width: `${(9 / 28) * 100}%` }}></div>
        </div>
      </div>
      <div className="w-full flex items-center justify-between text-[#232A25]">
        <div className="flex items-center gap-2">
          <CalenderIconSVG />
          <p className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em]">
            Mar 10, 10:00 AM - Mar 10, 11:30 AM
          </p>
        </div>

        <button className="px-3 py-2 text-xs font-[500] text-[12px] leading-[12px] tracking-[-0.02em] text-[#49734F] border border-[#49734F] rounded-lg">
          View details
        </button>
      </div>
    </div>
  );
};

export default TestCard;
