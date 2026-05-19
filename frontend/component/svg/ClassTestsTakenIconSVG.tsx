const ClassTestsTakenIconSVG = ({ width = 16 }: { width?: number }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="16" height="16" rx="2" fill="#ED8600" />
      <path
        d="M9.37501 3.4165H5.25001C5.0069 3.4165 4.77374 3.51308 4.60183 3.68499C4.42992 3.8569 4.33334 4.09006 4.33334 4.33317V11.6665C4.33334 11.9096 4.42992 12.1428 4.60183 12.3147C4.77374 12.4866 5.0069 12.5832 5.25001 12.5832H10.75C10.9931 12.5832 11.2263 12.4866 11.3982 12.3147C11.5701 12.1428 11.6667 11.9096 11.6667 11.6665V5.70817L9.37501 3.4165Z"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.91666 3.4165V5.24984C8.91666 5.49295 9.01323 5.72611 9.18514 5.89802C9.35705 6.06993 9.59021 6.1665 9.83332 6.1665H11.6667"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default ClassTestsTakenIconSVG;
