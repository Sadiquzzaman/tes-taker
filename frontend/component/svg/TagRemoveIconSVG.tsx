const TagRemoveIconSVG = ({ width = 14, className = "mt-[2px]" }: { width?: number; className?: string }) => {
  return (
    <svg className={className} width={width} height={width} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M1.58325 7.00016C1.58325 8.43675 2.15393 9.8145 3.16976 10.8303C4.18558 11.8461 5.56333 12.4168 6.99992 12.4168C8.43651 12.4168 9.81426 11.8461 10.8301 10.8303C11.8459 9.8145 12.4166 8.43675 12.4166 7.00016C12.4166 5.56357 11.8459 4.18582 10.8301 3.17C9.81426 2.15418 8.43651 1.5835 6.99992 1.5835C5.56333 1.5835 4.18558 2.15418 3.16976 3.17C2.15393 4.18582 1.58325 5.56357 1.58325 7.00016Z"
        stroke="#747775"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.625 5.375L5.375 8.625" stroke="#747775" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.375 5.375L8.625 8.625" stroke="#747775" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default TagRemoveIconSVG;
