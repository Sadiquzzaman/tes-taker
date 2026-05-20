const PublishCopyIconSVG = ({ width = 14 }: { width?: number }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4.5" y="4.5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1" />
      <path
        d="M1.5 9.5V2.5C1.5 1.95 1.95 1.5 2.5 1.5H9.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default PublishCopyIconSVG;
