const ScheduleClockIconSVG = ({ width = 16 }: { width?: number }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6.4" stroke="#49734F" strokeWidth="1.2" />
      <path d="M8 4.8V8L10.4 9.6" stroke="#49734F" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default ScheduleClockIconSVG;
