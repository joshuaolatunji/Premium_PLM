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
}


export interface ChangeTemporaryPasswordRequest {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}