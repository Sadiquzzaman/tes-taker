import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import PageLayout from "@/component/Layout";
import NotFoundIllustrationSVG from "@/component/svg/NotFoundIllustrationSVG";
import { buttonClasses } from "@/design/ui";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <PageLayout route="/" subText={t("title")}>
      <section className="flex min-h-full w-full items-center justify-center px-4 py-8">
        <div className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
          <NotFoundIllustrationSVG className="h-auto w-full max-w-md" />
          <div className="flex flex-col gap-2">
            <h1 className="text-display font-semibold text-ink">{t("heading")}</h1>
            <p className="text-body text-ink-muted">{t("detail")}</p>
          </div>
          <NextLink href="/dashboard" className={buttonClasses()}>
            {t("home")}
          </NextLink>
        </div>
      </section>
    </PageLayout>
  );
}
