import { configureApiClient } from "@/lib/api/client";
import {
  clearSession,
  getToken,
} from "@/features/auth/store/session";


configureApiClient({
  getToken,
  onUnauthorized: clearSession,
});
