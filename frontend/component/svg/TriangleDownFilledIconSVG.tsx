const TriangleDownFilledIconSVG = ({ width = 7 }: { width?: number }) => {
  const height = (width * 4) / 7;

  return (
    <svg width={width} height={height} viewBox="0 0 7 4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.33333 3.33333L6.66667 0H0L3.33333 3.33333Z" fill="currentColor" />
    </svg>
  );
};

export default TriangleDownFilledIconSVG;
