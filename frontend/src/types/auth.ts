import type { UserPreferences, UserProfile } from "./configuration";

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  status: "ACTIVE" | "LOCKED" | "DELETED";
  lastLoginAt: string | null;
};

export type CurrentUser = {
  account: AuthUser;
  profile: UserProfile | null;
  preferences: UserPreferences | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: string;
  user: AuthUser;
};
