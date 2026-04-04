const CalenderIconSVG = ({ width = 16 }: { width?: number }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.5 1.75V4.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 1.75V4.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3.625 3H12.375C12.375 3 13.625 3 13.625 4.25V13C13.625 13 13.625 14.25 12.375 14.25H3.625C3.625 14.25 2.375 14.25 2.375 13V4.25C2.375 4.25 2.375 3 3.625 3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.375 6.75H13.625" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default CalenderIconSVG;
