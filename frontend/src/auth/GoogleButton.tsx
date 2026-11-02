import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { startGoogle } from "../lib/google";
import type { GoogleIntent } from "../lib/google";
import { useResource } from "../lib/hooks";
import { ErrorNotice } from "../components/ui";

export default function GoogleButton({
  intent = "LOGIN",
  invitationToken,
  displayName,
  label,
}: {
  intent?: GoogleIntent;
  invitationToken?: string;
  displayName?: string;
  label?: string;
}) {
  const provider = useResource(
    useCallback(
      (signal) =>
        api.get<{ googleEnabled: boolean }>("/auth/providers", signal),
      [],
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  if (!provider.data?.googleEnabled) return null;
  async function begin() {
    setBusy(true);
    setError(null);
    try {
      await startGoogle(intent, invitationToken, displayName);
    } catch (failure) {
      setError(failure);
      setBusy(false);
    }
  }
  return (
    <div className="google-choice">
      <div className="auth-divider">
        <span />
        Hoặc
        <span />
      </div>
      <ErrorNotice error={error} />
      <button
        className="button button-google button-full"
        type="button"
        disabled={busy}
        onClick={begin}
      >
        <span className="google-mark" aria-hidden="true">
          G
        </span>
        {busy
          ? "Đang chuyển tới Google…"
          : label ||
            (intent === "REGISTER"
              ? "Đăng ký với Google"
              : "Tiếp tục với Google")}
      </button>
    </div>
  );
}
