"use client";

import { useToast } from "@/component/Toast/ToastContext";
import apiClient from "@/lib/axios";
import { RotatingLines } from "react-loader-spinner";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

const GoogleCallbackContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { triggerToast } = useToast();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    const error = searchParams.get("error");
    if (error) {
      triggerToast({
        title: "Google sign-in failed",
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
        title: "Google sign-in failed",
        description: "Missing authentication data from Google callback.",
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
        };

        const setTokenResponse = await apiClient.post("/api/set-token", {
          token: accessToken,
          refreshToken: refreshToken ?? "",
          role,
        });

        if (setTokenResponse.status !== 200) {
          throw new Error("Failed to store auth session");
        }

        localStorage.setItem("user", JSON.stringify(payload));

        triggerToast({
          title: "Login Successful",
          description: "Signed in with Google.",
          type: "success",
        });

        if (role === "STUDENT") {
          router.replace("/classes");
          return;
        }
        if (role === "ADMIN" || role === "SUPER_ADMIN") {
          router.replace("/admin");
          return;
        }
        router.replace("/dashboard");
      } catch {
        triggerToast({
          title: "Google sign-in failed",
          description: "Unable to complete sign-in. Please try again.",
          type: "error",
        });
        router.replace("/login");
      }
    };

    void completeSignIn();
  }, [router, searchParams, triggerToast]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <RotatingLines width="40" strokeColor="#49734F" />
    </div>
  );
};

const GoogleCallbackPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <RotatingLines width="40" strokeColor="#49734F" />
        </div>
      }
    >
      <GoogleCallbackContent />
    </Suspense>
  );
};

export default GoogleCallbackPage;
