import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError, clearCsrf } from "../lib/api";
import type { Account } from "../lib/types";
import { AuthContext } from "./useAuth";
export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [expired, setExpired] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const requestGeneration = generation.current;
    const current = () =>
      !controller.signal.aborted && generation.current === requestGeneration;
    api
      .get<Account>("/auth/me", controller.signal)
      .then((value) => {
        if (current()) setAccount(value);
      })
      .catch((failure) => {
        if (current()) {
          setAccount(null);
          if (!(failure instanceof ApiError && failure.status === 401))
            setError(failure);
        }
      })
      .finally(() => {
        if (current()) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const expire = () => {
      generation.current++;
      setAccount(null);
      setLoading(false);
      setExpired(true);
    };
    window.addEventListener("tinyclass:session-expired", expire);
    return () =>
      window.removeEventListener("tinyclass:session-expired", expire);
  }, []);
  async function login(email: string, password: string) {
    const value = await api.post<Account>("/auth/login", { email, password });
    generation.current++;
    clearCsrf();
    setAccount(value);
    setLoading(false);
    setExpired(false);
    setError(null);
    return value;
  }
  async function logout() {
    await api.post("/auth/logout", {});
    endSession();
  }
  function endSession() {
    generation.current++;
    clearCsrf();
    setAccount(null);
    setLoading(false);
    setExpired(false);
  }
  function retry() {
    setLoading(true);
    setError(null);
    setRevision((value) => value + 1);
  }
  return (
    <AuthContext.Provider
      value={{
        account,
        loading,
        error,
        expired,
        login,
        logout,
        endSession,
        retry,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
