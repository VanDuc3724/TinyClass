import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { AuthLayout } from "./AuthPages";
import { ErrorNotice, Field, Loading } from "../components/ui";
import { api } from "../lib/api";

export default function PasswordSetupPage() {
  const location = useLocation(),
    navigate = useNavigate(),
    auth = useAuth();
  const [token] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("token") || "",
  );
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget),
      password = String(values.get("password"));
    if (password !== values.get("confirmPassword")) {
      setError(new Error("Hai mật khẩu chưa trùng nhau."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/password-setups", { token, password });
      setDone(true);
      auth.endSession();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  if (auth.loading) return <Loading />;
  return (
    <AuthLayout>
      <div className="auth-card">
        <p className="eyebrow">THÊM MỘT CÁCH ĐĂNG NHẬP</p>
        <h2>
          {done ? "Đã thiết lập mật khẩu." : "Thêm mật khẩu cho tài khoản"}
        </h2>
        <ErrorNotice error={error} />
        {done ? (
          <>
            <p className="muted">
              Phương thức Google vẫn được giữ. Các phiên cũ đã hết hiệu lực;
              đăng nhập lại bằng Google hoặc mật khẩu mới.
            </p>
            <Link className="button button-primary button-full" to="/login">
              Đăng nhập lại
            </Link>
          </>
        ) : !auth.account ? (
          <>
            <p className="info-notice">
              Mở liên kết này trong trình duyệt đang đăng nhập đúng tài khoản đã
              yêu cầu thêm mật khẩu. Nếu cần, đăng nhập trước rồi mở lại email.
            </p>
            <Link to="/login" className="button button-primary button-full">
              Về đăng nhập
            </Link>
          </>
        ) : !token ? (
          <p className="info-notice">
            Thiếu liên kết thiết lập. Yêu cầu liên kết mới từ trang Tài khoản.
          </p>
        ) : (
          <>
            <p className="muted">
              Bạn đang thiết lập cho {auth.account.email}. Chọn mật khẩu 12–128
              ký tự.
            </p>
            <form onSubmit={submit}>
              <Field label="Mật khẩu mới">
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  disabled={busy}
                />
              </Field>
              <Field label="Nhập lại mật khẩu mới">
                <input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  disabled={busy}
                />
              </Field>
              <button
                className="button button-primary button-full"
                disabled={busy}
              >
                {busy ? "Đang thiết lập…" : "Thiết lập mật khẩu"}
              </button>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
