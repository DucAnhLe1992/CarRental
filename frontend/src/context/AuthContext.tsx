import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchMe, logoutUser } from "../lib/api";
import type { User } from "../types/user";
import { AuthContext, type AuthState } from "./authContext";

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


