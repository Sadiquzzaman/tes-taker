const MicrophoneIconSVG = ({ width = "16" }: { width?: string }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 1.5C7.0335 1.5 6.25 2.2835 6.25 3.25V8C6.25 8.9665 7.0335 9.75 8 9.75C8.9665 9.75 9.75 8.9665 9.75 8V3.25C9.75 2.2835 8.9665 1.5 8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.25 6.7998V8.0498C12.25 10.3971 10.3472 12.2998 8 12.2998C5.65279 12.2998 3.75 10.3971 3.75 8.0498V6.7998"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 12.3008V14.5008" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.6665 14.5H10.3332" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default MicrophoneIconSVG;
