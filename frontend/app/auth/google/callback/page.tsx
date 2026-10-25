"use client";

import { useToast } from "@/component/Toast/ToastContext";
import { persistAuthSession } from "@/lib/authSession";
import { restoreLastWorkspace } from "@/lib/restoreLastWorkspace";
import { Spinner } from "@/design/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useRef } from "react";

/** A quiet holding screen while the sign-in finishes. */
const SigningIn = () => {
  const t = useTranslations("auth.google");
  return (
    <div role="status" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-ink-muted">
      <Spinner className="size-8 text-primary" />
      <p className="text-body-sm">{t("signingIn")}</p>
    </div>
  );
};

const GoogleCallbackContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { triggerToast } = useToast();
  const t = useTranslations("auth.google");
  const tLogin = useTranslations("auth.login");
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    const error = searchParams.get("error");
    if (error) {
      triggerToast({
        title: t("failedTitle"),
        description: decodeURIComponent(error),
        type: "error",
      });
      router.replace("/login");
      return;
    }

    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");
    const role = searchParams.get("role");

    if (!accessToken || !role) {
      triggerToast({
        title: t("failedTitle"),
        description: t("missingData"),
        type: "error",
      });
      router.replace("/login");
      return;
    }

    const completeSignIn = async () => {
      try {
        const payload = {
          id: searchParams.get("id") ?? "",
          full_name: searchParams.get("full_name") ?? "",
          email: searchParams.get("email") ?? "",
          phone: searchParams.get("phone") ?? "",
          role,
          access_token: accessToken,
          refresh_token: refreshToken ?? "",
        } as LoginResponsePayload;

        await persistAuthSession(payload);
        const restored = await restoreLastWorkspace(payload);

        triggerToast({
          title: tLogin("successTitle"),
          description: t("doneDescription"),
          type: "success",
        });

        if (role === "ADMIN" || role === "SUPER_ADMIN") {
          router.replace("/admin");
          return;
        }
        router.replace(restored.href);
      } catch {
        triggerToast({
          title: t("failedTitle"),
          description: t("failed"),
          type: "error",
        });
        router.replace("/login");
      }
    };

    void completeSignIn();
  }, [router, searchParams, t, tLogin, triggerToast]);

  return <SigningIn />;
};

const GoogleCallbackPage = () => {
  return (
    <Suspense
      fallback={<SigningIn />}
    >
      <GoogleCallbackContent />
    </Suspense>
  );
};

export default GoogleCallbackPage;
