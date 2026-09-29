// PLMAdmin / PLMAuth DTOs, verified against the live Swagger spec.
export interface PLMRole {
  roleId: string | null;
  roleName: string | null;
}

export interface CreateUserRequest {
  username: string;
  emailAddress: string;
  firstName: string;
  lastName: string;
}

export interface AssignRoleRequest {
  userId: string;
  roleId: string;
}

export interface RemoveRoleRequest {
  userId: string;
  roleId: string;
}

export interface AdminResetPasswordRequest {
  email: string;
  newPassword: string;
  confirmPassword: string;
}
