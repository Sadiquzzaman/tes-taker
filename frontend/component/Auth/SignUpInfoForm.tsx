import AuthInput from "@/Ui/AuthInput";
import ContinueWithGoogle from "./ContinueWithGoogle";
import ButtonLoader from "../Loader/ButtonLoadder";

const SignUpInfoForm = ({
  signUpInfo,
  formError,
  checkboxError,
  loading,
  handleFieldChange,
  handleSignUp,
}: SignUpInfoFormProps) => {
  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-8">
      <div className="flex flex-row justify-between items-center mb-2">
        <h2 className="text-[32px] font-semibold text-[#0F1A12] leading-[39px] tracking-[-0.02em] capitalize">
          Sign Up
        </h2>
        <div className="flex gap-0.5 ml-2">
          <div className="w-4 h-1 rounded-[2px] bg-[#49734F]" />
          <div className="w-4 h-1 rounded-[2px] bg-[#E5E5E5]" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <AuthInput
          value={signUpInfo.full_name}
          onChange={(e) => handleFieldChange("full_name", e.target.value)}
          formError={formError.full_name}
          placeholder="e.g., John Doe"
          label="Full name"
        />
        <AuthInput
          value={signUpInfo.phone}
          onChange={(e) => handleFieldChange("phone", e.target.value)}
          type="number"
          formError={formError.phone}
          placeholder="Enter phone number"
          label="Phone"
        />
        <AuthInput
          value={signUpInfo.password}
          onChange={(e) => handleFieldChange("password", e.target.value)}
          type="password"
          formError={formError.password}
          placeholder="Enter password"
          label="Password"
        />
        <AuthInput
          value={signUpInfo.confirm_password}
          onChange={(e) => handleFieldChange("confirm_password", e.target.value)}
          type="password"
          formError={formError.confirm_password}
          placeholder="Confirm password"
          label="Confirm Password"
        />
        <AuthInput
          value={signUpInfo.email || ""}
          onChange={(e) => handleFieldChange("email", e.target.value)}
          formError={formError.email}
          placeholder="Enter email address"
          label="Email (Optional)"
        />
        <AuthInput
          value={signUpInfo.organization}
          onChange={(e) => handleFieldChange("organization", e.target.value)}
          formError={formError.organization}
          placeholder="e.g., ABC Studies"
          label="Organization / school name (Optional)"
        />

        <div className="flex flex-row items-center gap-2 py-2">
          <input
            id="terms"
            type="checkbox"
            checked={signUpInfo.agreed}
            onChange={(e) => handleFieldChange("agreed", e.target.checked)}
            className="w-5 h-5 accent-[#49734F] border border-[#E5E5E5] rounded focus:ring-2 focus:ring-green-500"
          />
          <label htmlFor="terms" className="text-[#747775] font-regular text-[16px]">
            I agree to the{" "}
            <a href="#" className="underline font-medium">
              Terms of Service
            </a>{" "}
            and the{" "}
            <a href="#" className="underline font-medium">
              Privacy Policy
            </a>
            .
          </label>
        </div>

        {checkboxError && (
          <p className="font-normal text-[16px] leading-[125%] tracking-[-0.02em] text-[#D24B44] align-middle">
            {checkboxError}
          </p>
        )}

        <button
          onClick={handleSignUp}
          className="w-full mt-4 bg-[#49734F] text-white py-3 rounded-lg font-medium mb-4 hover:bg-green-800 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-gray-400"
          disabled={loading}
        >
          <ButtonLoader show={loading} w="w-4" h="h-4" mr="mr-2" />
          {loading ? "Signing Up..." : "Sign Up"}
        </button>
      </div>

      <div className="flex flex-row items-center gap-5 my-0">
        <hr className="flex-grow border-[#E5E5E5]" />
        <span className="text-[#747775] text-[14px]">OR</span>
        <hr className="flex-grow border-[#E5E5E5]" />
      </div>
      <ContinueWithGoogle />
    </div>
  );
};

export default SignUpInfoForm;
