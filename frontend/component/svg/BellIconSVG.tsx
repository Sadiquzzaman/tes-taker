const BellIconSVG = ({ width = 16 }: { width?: number }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.3002 5.53301C4.3002 4.55171 4.69002 3.6106 5.3839 2.91671C6.07778 2.22283 7.01889 1.83301 8.0002 1.83301C8.9815 1.83301 9.92261 2.22283 10.6165 2.91671C11.3104 3.6106 11.7002 4.55171 11.7002 5.53301C11.7002 9.84967 13.5502 11.083 13.5502 11.083H2.4502C2.4502 11.083 4.3002 9.84967 4.3002 5.53301Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.95215 13.5498C7.05537 13.7375 7.20711 13.8941 7.39152 14.0032C7.57593 14.1122 7.78624 14.1698 8.00048 14.1698C8.21472 14.1698 8.42504 14.1122 8.60945 14.0032C8.79386 13.8941 8.9456 13.7375 9.04882 13.5498"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default BellIconSVG;
