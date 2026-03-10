const ButtonLoader = ({
  w = "w-full",
  h = "h-full",
  mr = "mr-0",
  ml = "ml-0",
  mt = "mt-0",
  mb = "mb-0",
  show = false,
}: {
  w?: string;
  h?: string;
  mr?: string;
  ml?: string;
  mt?: string;
  mb?: string;
  show?: boolean;
}) => {
  if (!show) return null;
  return (
    <svg
      className={`${w} ${h} ${mr} ${ml} ${mt} ${mb} animate-spin`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>{" "}
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
  );
};

export default ButtonLoader;
