enum UserRoleEnum {
  STUDENT = "STUDENT",
  TEACHER = "TEACHER",
}
interface SignUpInfo {
  full_name: string;
  password: string;
  confirm_password: string;
  email?: string;
  phone: string;
  organization: string;
  agreed: boolean;
  role: UserRoleEnum;
}

interface LoginInfo {
  phone: string;
  password: string;
}

type SignUpPageView = "signup" | "otp";

interface SignUpInfoFormProps {
  signUpInfo: SignUpInfo;
  setSignUpInfo: Dispatch<SetStateAction<SignUpInfo>>;
  setView: Dispatch<SetStateAction<SignUpPageView>>;
}

interface AuthInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  formError?: string;
  placeholder: string;
  label: string;
  type?: string;
}
