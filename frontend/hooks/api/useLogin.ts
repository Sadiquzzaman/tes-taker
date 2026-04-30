import { useToast } from "@/component/Toast/ToastContext";
import axios from "@/lib/axios";
import axiosReq from "@/lib/axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useJoinStateManage from "../ui/useJoinStateManage";

const useLogin = () => {
  const { triggerToast } = useToast();
  const { joinInfo } = useJoinStateManage("login");
  const [loading, setLoading] = useState(false);
  const { push } = useRouter();

  const mutate = async (loginInfo: LoginPayload) => {
    setLoading(true);

    return axiosReq
      .post(`${process.env.NEXT_PUBLIC_BASE_URL}/auth/login`, loginInfo)
      .then(async (response) => {
        setLoading(false);
        if (response.status === 200) {
          triggerToast({
            title: "Login Successful",
            description: response.data.payload?.message || "User login successful.",
            type: "success",
          });

          await axios
            .post("/api/set-token", {
              token: response.data.payload.access_token,
              refreshToken: response.data.payload.refresh_token,
            })
            .then(async (setTokenResponse) => {
              if (setTokenResponse.status === 200) {
                localStorage.setItem("user", JSON.stringify(response.data.payload));

                if (joinInfo?.joinType === "class" && joinInfo?.id && response.data?.payload?.role === "STUDENT") {
                  await axiosReq
                    .post(`${process.env.NEXT_PUBLIC_BASE_URL}/classes/${joinInfo.id}/join`, {})
                    .then((res) => {
                      console.log({ res });
                      triggerToast({
                        title: "Class Join Successful",
                        description: res?.data?.message || "",
                        type: "success",
                      });

                      sessionStorage.setItem("classJoinResponse", JSON.stringify(res?.data?.payload));
                      push("/join/class");
                    })
                    .catch((err) => console.log({ err }));
                } else if (
                  joinInfo?.joinType === "test" &&
                  joinInfo?.id &&
                  response.data?.payload?.role === "STUDENT"
                ) {
                  await axiosReq
                    .get(`${process.env.NEXT_PUBLIC_BASE_URL}/student/exams/${joinInfo.id}/eligibility`)
                    .then((res) => {
                      console.log({ res });
                      if (res.data?.payload?.eligible) {
                        axiosReq
                          .post(`${process.env.NEXT_PUBLIC_BASE_URL}/classes/${joinInfo.id}/join`, {})
                          .then((res) => {})
                          .catch((err) => console.log({ err }));
                      }

                      sessionStorage.setItem("testJoinResponse", JSON.stringify(res?.data?.payload));
                      push("/join/test");
                    })
                    .catch((err) => console.log({ err }));
                } else {
                  push("/");
                }
              }
            });
        } else {
          throw new Error("Unexpected response status");
        }
      })
      .catch((error) => {
        setLoading(false);
        console.log({ error });
        if (error?.response?.data?.message?.message?.length) {
          const messages = error.response.data.message.message;
          messages.forEach((msg: string) => {
            triggerToast({
              title: "Login Failed",
              description: msg,
              type: "error",
            });
          });
          return;
        }
        const message = error?.response?.data?.message || "Failed to send OTP. Please try again.";
        triggerToast({
          title: "Login Failed",
          description: message,
          type: "error",
        });
      });
  };

  return [mutate, { loading }] as const;
};

export default useLogin;
