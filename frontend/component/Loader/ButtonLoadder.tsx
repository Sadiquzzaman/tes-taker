import SpinnerIconSVG from "../svg/SpinnerIconSVG";

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
    <SpinnerIconSVG className={`${w} ${h} ${mr} ${ml} ${mt} ${mb} animate-spin`} />
  );
};

export default ButtonLoader;
