import { createContext, useContext } from "react";
import type { Account } from "../lib/types";
export interface AuthState {
  account: Account | null;
  loading: boolean;
  error: unknown;
  expired: boolean;
  login: (email: string, password: string) => Promise<Account>;
  logout: () => Promise<void>;
  endSession: () => void;
  retry: () => void;
}
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Missing AuthProvider");
  return value;
}
