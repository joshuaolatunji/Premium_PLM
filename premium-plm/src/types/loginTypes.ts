export interface LoginRequest {
    emailAddress: string;
    password: string;
}


export interface LoginResponse {
    statusCode: number;
    isSuccessful: boolean;
    message: string;
    data: LoginResponseData;
}

export interface LoginResponseData {
    token: string ;
    expiresAt: string;
    userName: string;
    email: string;
    roles: string[];
    // Not sent yet (gaps file M38); saved and shown as soon as it is.
    firstName?: string | null;
    lastName?: string | null;
}


export interface ChangeTemporaryPasswordRequest {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}