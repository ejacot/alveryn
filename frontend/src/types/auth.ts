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
  founder?: boolean;
};

export type AuthTokens = {
  accessToken: string;
  tokenType: string;
  accessTokenExpiresIn: number;
  user: AuthUser;
};
