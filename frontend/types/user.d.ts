interface User {
  id: string;
  is_active: number;
  created_by: string;
  created_user_name: string;
  updated_by: string;
  updated_user_name: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  email: string;
  phone: string;
  is_verified: boolean;
  role: UserRoleEnum;
  refresh_token: string;
  access_token: string;
}
