const RemainingIconSVG = ({ width = 16 }: { width?: number }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.375 8C2.375 9.11252 2.7049 10.2001 3.32298 11.1251C3.94107 12.0501 4.81957 12.7711 5.84741 13.1968C6.87524 13.6226 8.00624 13.734 9.09738 13.5169C10.1885 13.2999 11.1908 12.7641 11.9775 11.9775C12.7641 11.1908 13.2999 10.1885 13.5169 9.09738C13.734 8.00624 13.6226 6.87524 13.1968 5.84741C12.7711 4.81957 12.0501 3.94107 11.1251 3.32298C10.2001 2.7049 9.11252 2.375 8 2.375C6.42747 2.38092 4.91811 2.99451 3.7875 4.0875L2.375 5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.375 2.375V5.5H5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 4.875V8L10.5 9.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default RemainingIconSVG;
