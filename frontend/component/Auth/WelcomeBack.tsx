import Image from "next/image";
import { useTranslations } from "next-intl";
import WelcomeArrowIconSVG from "../svg/WelcomeArrowIconSVG";

/** The illustration panel beside the auth forms, on tablet and wider. */
const WelcomeBack = () => {
  const t = useTranslations("auth");

  return (
    <div className="relative m-4 hidden md:block md:w-1/2">
      <Image src="/assets/image/frontPage.jpg" alt={t("illustrationAlt")} fill sizes="50vw" className="rounded-sheet object-cover" />
      <div className="absolute inset-0 rounded-sheet bg-linear-to-b from-surface/60 to-surface/0" />
      <div className="absolute inset-x-0 top-12">
        <div className="mx-auto flex w-4/5 flex-col gap-8">
          <div className="flex items-center justify-between">
            <p className="text-body font-medium uppercase tracking-widest text-primary">{t("welcomeBack")}</p>
            <span className="text-primary">
              <WelcomeArrowIconSVG width={25} />
            </span>
          </div>
          <p className="text-display font-medium text-ink">
            {t.rich("tagline", { highlight: (chunks) => <span className="text-primary">{chunks}</span> })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBack;
