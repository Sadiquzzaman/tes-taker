const TriangleUpFilledIconSVG = ({ width = 7 }: { width?: number }) => {
  const height = (width * 4) / 7;

  return (
    <svg width={width} height={height} viewBox="0 0 7 4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.33333 -0.000325203L6.66667 3.33301H0L3.33333 -0.000325203Z" fill="currentColor" />
    </svg>
  );
};

export default TriangleUpFilledIconSVG;
