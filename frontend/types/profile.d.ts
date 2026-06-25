interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  role: UserRoleEnum;
  is_verified: boolean;
  is_otp_verified?: boolean;
  is_active?: number;
  created_at: string;
  updated_at: string;
}
