import NotFoundIllustrationSVG from "@/component/svg/NotFoundIllustrationSVG";
import PageLayout from "@/component/Layout";

export default function NotFound() {
  return (
    <PageLayout route="/" subText="Page not found">
      <section className="flex min-h-full w-full items-center justify-center bg-white px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex w-full max-w-[1184px] flex-col items-center justify-center gap-4 pb-[120px]">
          <div className="w-full max-w-[600px]">
            <NotFoundIllustrationSVG className="h-auto w-full" />
          </div>

          <div className="flex max-w-[780px] flex-col items-center gap-4 text-center">
            <h1
              className="text-[32px] font-[600] leading-[100%] tracking-[-0.02em] text-[#232A25] sm:text-[40px]"
              style={{ fontFamily: "Public Sans" }}
            >
              Oops! This page does not exist.
            </h1>
            <p className="text-[14px] font-[400] leading-[20px] tracking-[-0.02em] text-[#747775] sm:text-[18px]">
              You may have entered the wrong address, or the page may have been moved or removed.
            </p>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
