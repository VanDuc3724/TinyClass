import { useState } from "react";
import { useAuth } from "./useAuth";
import { api } from "../lib/api";
import { ErrorNotice, Icon } from "../components/ui";

export default function VerificationPrompt({
  invitationToken,
}: {
  invitationToken?: string;
}) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState<unknown>(null);
  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/email-verifications", { invitationToken });
      setNotice(
        "Yêu cầu đã được tiếp nhận. Kiểm tra hộp thư và mở liên kết xác minh mới nhất.",
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="verification-prompt">
      <span className="welcome-icon">
        <Icon name="lock" />
      </span>
      <h2>Xác minh email để tiếp tục</h2>
      <p className="muted">
        Mở liên kết xác minh trong email gửi đến{" "}
        <strong>{auth.account?.email}</strong>.{" "}
        {auth.account?.role === "TEACHER"
          ? "Xác minh để bảo đảm email liên hệ của bạn chính xác."
          : "Sau đó quay lại để nhận lời mời và xem hồ sơ của bé."}
      </p>
      <ErrorNotice error={error} />
      {notice && (
        <p className="info-notice" role="status">
          {notice}
        </p>
      )}
      <div className="verification-actions">
        <button
          className="button button-primary"
          disabled={busy || auth.loading}
          onClick={auth.retry}
        >
          Tôi đã xác minh
        </button>
        <button
          className="button button-ghost"
          disabled={busy || auth.loading}
          onClick={resend}
        >
          {busy ? "Đang gửi…" : "Gửi lại email xác minh"}
        </button>
      </div>
    </section>
  );
}
