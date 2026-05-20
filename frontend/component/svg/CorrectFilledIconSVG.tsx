const CorrectFilledIconSVG = ({ width = 16, className = "" }: { width?: number; className?: string }) => {
  return (
    <svg
      className={className}
      width={width}
      height={width}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 16C3.5816 16 0 12.4184 0 8C0 3.5816 3.5816 0 8 0C12.4184 0 16 3.5816 16 8C16 12.4184 12.4184 16 8 16ZM7.0584 9.712L4.8464 7.4984L4 8.3448L6.4952 10.8416C6.64522 10.9916 6.84867 11.0758 7.0608 11.0758C7.27293 11.0758 7.47638 10.9916 7.6264 10.8416L12.388 6.0816L11.5384 5.232L7.0584 9.712Z"
        fill="#49734F"
      />
    </svg>
  );
};

export default CorrectFilledIconSVG;
