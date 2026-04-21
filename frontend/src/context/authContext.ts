import { createContext } from "react";
import type { User } from "../types/user";

export type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: User }
  | { status: "unauthenticated" };

export type AuthContextValue = {
  auth: AuthState;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
