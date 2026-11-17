import Image from "next/image";

/**
 * The Instructor logo mark (17 Nov 2026: the new logo, transparent PNG from
 * `public/brand/instructor-logo-source.jpg`). Decorative: the word "Instructor" beside it names the
 * product, so the image has no alt text of its own.
 */
const InstructorLogoMarkSVG = ({ width = 28 }: { width?: number }) => {
  // A small static file: served as it is, never through the image optimiser.
  return <Image src="/brand/logo-128.png" width={width} height={width} alt="" aria-hidden="true" priority unoptimized />;
};

export default InstructorLogoMarkSVG;
