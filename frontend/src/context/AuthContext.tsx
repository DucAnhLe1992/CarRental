import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fetchMe, logoutUser } from "../lib/api";
import type { User } from "../types/user";

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: User }
  | { status: "unauthenticated" };

type AuthContextValue = {
  auth: AuthState;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    fetchMe()
      .then((user) => setAuth({ status: "authenticated", user }))
      .catch(() => setAuth({ status: "unauthenticated" }));
  }, []);

  const setUser = useCallback((user: User) => {
    setAuth({ status: "authenticated", user });
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setAuth({ status: "unauthenticated" });
  }, []);

  return (
    <AuthContext.Provider value={{ auth, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
