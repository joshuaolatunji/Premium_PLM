export interface LoginRequest {
    emailAddress: string;
    password: string;
}

export interface LoginResponseData {
    token: string ;
    expiresAt: string;
    userName: string;
    email: string;
    roles: string[];
}

export interface LoginResponse {
    statusCode: number;
    isSuccessful: boolean;
    message: string;
    data: LoginResponseData;
}