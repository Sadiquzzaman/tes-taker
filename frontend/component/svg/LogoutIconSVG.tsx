const LogoutIconSVG = ({ width = 14 }: { width?: number }) => {
  return (
    <svg width={width} height={width} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5.375 11.875H3.20833C2.92102 11.875 2.64547 11.7609 2.4423 11.5577C2.23914 11.3545 2.125 11.079 2.125 10.7917V3.20833C2.125 2.92102 2.23914 2.64547 2.4423 2.4423C2.64547 2.23914 2.92102 2.125 3.20833 2.125H5.375"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.16667 9.70817L11.875 6.99984L9.16667 4.2915"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11.875 7H5.375" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default LogoutIconSVG;
