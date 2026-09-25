export interface PLMUser {
  userId: string;
  userName: string;
  email: string;
  role: string[];
  emailConfirmed: boolean;
  isLockedOut: boolean;
}
