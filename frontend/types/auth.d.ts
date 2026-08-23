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
  agreed: boolean;
  role: UserRoleEnum;
  request_teacher?: boolean;
}

interface LoginInfo {
  identifier: string;
  password: string;
}

interface OrganizationLoginInfo {
  organization_number: string;
  phone: string;
  password: string;
}

type LoginPayload =
  | {
      phone: string;
      password: string;
    }
  | {
      email: string;
      password: string;
    };

type OrganizationLoginPayload = {
  organization_number: string;
  phone: string;
  password: string;
};

type SignUpPageView = "choice" | "signup" | "otp";

interface SignUpInfoFormProps {
  signUpInfo: SignUpInfo;
  formError: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    confirm_password: string;
  };
  checkboxError: string;
  loading: boolean;
  handleFieldChange: <K extends keyof SignUpInfo>(field: K, value: SignUpInfo[K]) => void;
  handleSignUp: () => void;
  onBackToChoice?: () => void;
  title?: string;
  description?: string;
}

interface AuthInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  formError?: string;
  placeholder: string;
  label: string;
  type?: string;
}

type LoginResponsePayload = User & {
  message?: string;
};

interface VerifyCodeProps {
  value: string;
  successTitle?: string;
  successDescription?: string;
}
