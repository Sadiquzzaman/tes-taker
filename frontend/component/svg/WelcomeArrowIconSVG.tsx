const WelcomeArrowIconSVG = ({ width = 25 }: { width?: number }) => {
  const height = (width * 12) / 25;

  return (
    <svg width={width} height={height} viewBox="0 0 25 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M24.5303 6.05328C24.8232 5.76039 24.8232 5.28551 24.5303 4.99262L19.7574 0.219648C19.4645 -0.073245 18.9896 -0.073245 18.6967 0.219648C18.4038 0.512542 18.4038 0.987415 18.6967 1.28031L22.9393 5.52295L18.6967 9.76559C18.4038 10.0585 18.4038 10.5334 18.6967 10.8263C18.9896 11.1191 19.4645 11.1191 19.7574 10.8263L24.5303 6.05328ZM0 5.52295V6.27295H24V5.52295V4.77295H0V5.52295Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default WelcomeArrowIconSVG;
