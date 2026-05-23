const EyeClosedIconSVG = ({ className = "w-5 h-5" }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18M9.88 9.88A3 3 0 0012 15a3 3 0 002.12-5.12M6.53 6.53C4.06 8.36 2.25 12 2.25 12s3.75 7.5 9.75 7.5c2.13 0 4.09-.54 5.72-1.47M17.47 17.47C19.94 15.64 21.75 12 21.75 12s-3.75-7.5-9.75-7.5c-2.13 0-4.09.54-5.72 1.47"
      />
    </svg>
  );
};

export default EyeClosedIconSVG;
