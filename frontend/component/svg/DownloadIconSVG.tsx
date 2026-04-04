const DownloadIconSVG = ({ width = 16 }: { width?: number }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13.55 9.84961V12.3163C13.55 12.6434 13.4201 12.9571 13.1888 13.1884C12.9575 13.4197 12.6438 13.5496 12.3167 13.5496H3.68335C3.35625 13.5496 3.04254 13.4197 2.81125 13.1884C2.57995 12.9571 2.45001 12.6434 2.45001 12.3163V9.84961"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.91666 6.7666L7.99999 9.84994L11.0833 6.7666"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 9.8502V2.4502" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default DownloadIconSVG;
