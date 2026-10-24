import { useTranslations } from "next-intl";
import Image from "next/image";
import WelcomeArrowIconSVG from "../svg/WelcomeArrowIconSVG";

const WelcomeBack = () => {
  const t = useTranslations("auth");

  return (
    <div className="hidden md:block md:w-1/2 relative m-4">
      <Image src={"/assets/image/frontPage.jpg"} alt={t("illustrationAlt")} fill className="object-cover rounded-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/0"></div>
      <div className="absolute top-12 left-0 text-left">
        <div className="mx-auto w-4/5">
          <div className="flex justify-between align-items-center mb-8">
            <h4 className="text-primary uppercase tracking-widest font-medium mb-2">{t("welcomeBack")}</h4>
            <div className="flex flex-column justify-center text-primary">
              <WelcomeArrowIconSVG width={25} />
            </div>
          </div>
          <h1 className="text-display font-medium text-ink">
            {t.rich("tagline", {
              highlight: (chunks) => <span className="text-primary">{chunks}</span>,
            })}
          </h1>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBack;
