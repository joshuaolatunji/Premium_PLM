export interface PLMUser {
  userId: string;
  userName: string;
  email: string;
  role: string[];
  emailConfirmed: boolean;
  isLockedOut: boolean;
  // The account's activated/deactivated state (UserResponseDto.isActive) —
  // what activate-user / deactivate-user actually change. `isLockedOut` is
  // a separate sign-in lockout and is NOT affected by deactivation.
  isActive: boolean;
  // Not returned by get_all_users yet (gaps file M22); used as soon as they are.
  firstName?: string | null;
  lastName?: string | null;
}
