const FileIconSVG = ({ width = 16 }: { width?: number }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.61901 1.604H3.76276C3.47655 1.604 3.20206 1.7177 2.99967 1.92008C2.79729 2.12247 2.68359 2.39696 2.68359 2.68317V11.3165C2.68359 11.6027 2.79729 11.8772 2.99967 12.0796C3.20206 12.282 3.47655 12.3957 3.76276 12.3957H10.2378C10.524 12.3957 10.7985 12.282 11.0008 12.0796C11.2032 11.8772 11.3169 11.6027 11.3169 11.3165V4.30192L8.61901 1.604Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.0791 1.604V3.76234C8.0791 4.04855 8.1928 4.32304 8.39518 4.52542C8.59756 4.72781 8.87206 4.8415 9.15827 4.8415H11.3166"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default FileIconSVG;
