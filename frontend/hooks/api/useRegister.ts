import { useToast } from "@/component/Toast/ToastContext";
import axiosReq from "@/lib/axios";
import { useState } from "react";

const useRegister = () => {
  const { triggerToast } = useToast();
  const [loading, setLoading] = useState(false);

  const mutate = async (registerParams: SignUpInfo) => {
    const requestData: any = { ...registerParams };
    if (!registerParams.email) delete requestData.email;

    setLoading(true);

    return axiosReq
      .post(`${process.env.NEXT_PUBLIC_BASE_URL}/auth/register`, requestData)
      .then((response) => {
        setLoading(false);
        if (response.status === 201) {
          triggerToast({
            title: "OTP Sent",
            description: response.data.payload?.message || "A new OTP code has been sent to your email.",
            type: "success",
          });

          return response.data;
        }
      })
      .catch((error) => {
        const message = error?.response?.data?.message || "Signup failed. Please try again.";
        triggerToast({
          title: "Sign Up Failed",
          description: message,
          type: "error",
        });
        setLoading(false);
      });
  };

  return [mutate, { loading }] as const;
};

export default useRegister;
