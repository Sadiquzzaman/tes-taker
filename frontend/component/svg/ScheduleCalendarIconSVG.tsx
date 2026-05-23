const ScheduleCalendarIconSVG = ({ width = 16 }: { width?: number }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" stroke="#49734F" strokeWidth="1.2" />
      <path d="M1.5 6.5H14.5" stroke="#49734F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5.5 1.5V4.5" stroke="#49734F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10.5 1.5V4.5" stroke="#49734F" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
};

export default ScheduleCalendarIconSVG;
