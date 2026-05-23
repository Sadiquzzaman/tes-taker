export const InvitedBadge = () => {
  return (
    <div
      className="flex items-center justify-center px-2 py-1 gap-2 w-14 h-6 
        bg-[rgba(255,145,0,0.1)] border border-[rgba(255,145,0,0.1)] 
        rounded-[27px] box-border"
    >
      <span
        className="text-[#ED8600] text-[12px] leading-[12px] font-medium 
            tracking-[-0.02em] font-['Instrument_Sans'] flex items-center"
      >
        Invited
      </span>
    </div>
  );
};

export const JoinedBadge = () => {
  return (
    <div
      className="flex items-center justify-center px-2 py-1 gap-2 w-14 h-6
        bg-[rgba(0,233,33,0.15)] border-[0.5px] border-[rgba(0,233,33,0.15)]
        rounded-[27px] box-border"
    >
      <span
        className="text-[#49734F] text-[12px] leading-[12px] font-medium
            tracking-[-0.02em] font-['Instrument_Sans'] flex items-center"
      >
        Joined
      </span>
    </div>
  );
};
