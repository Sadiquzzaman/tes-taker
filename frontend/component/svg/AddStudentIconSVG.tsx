const AddStudentIconSVG = ({ width = 14 }: { width?: number }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5.5" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 12C1 9.79086 3.01472 8 5.5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10 9V13M8 11H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
};

export default AddStudentIconSVG;
