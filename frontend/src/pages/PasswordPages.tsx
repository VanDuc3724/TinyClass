import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { ErrorNotice, Field, Icon } from "../components/ui";
import { api } from "../lib/api";
import { AuthLayout } from "./AuthPages";

export function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/password-reset-requests", { email });
      setDone(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <div className="auth-card">
        <p className="eyebrow">TRỞ LẠI LỚP NHỎ</p>
        <h2>Quên mật khẩu?</h2>
        <p className="muted">
          Nhập email đã dùng với TinyClass để yêu cầu liên kết đặt lại mật khẩu.
        </p>
        <ErrorNotice error={error} />
        {done ? (
          <p className="info-notice" role="status">
            Nếu email có tài khoản hỗ trợ đăng nhập bằng mật khẩu, hướng dẫn
            khôi phục sẽ được gửi đến hộp thư. Bạn cũng có thể kiểm tra mục thư
            rác.
          </p>
        ) : (
          <form onSubmit={submit}>
            <Field label="Địa chỉ email">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                disabled={busy}
              />
            </Field>
            <button
              className="button button-primary button-full"
              disabled={busy}
            >
              {busy ? "Đang gửi yêu cầu…" : "Gửi hướng dẫn khôi phục"}
              <Icon name="arrow" />
            </button>
          </form>
        )}
        <p className="auth-help">
          <Link to="/login">Trở về đăng nhập</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
export function ResetPasswordPage() {
  const location = useLocation(),
    navigate = useNavigate(),
    auth = useAuth();
  const [token] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("token") || "",
  );
  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget),
      password = String(values.get("password"));
    if (password !== values.get("confirmPassword")) {
      setError(
        new Error("Hai mật khẩu chưa trùng nhau. Vui lòng kiểm tra lại."),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/password-resets", { token, password });
      setDone(true);
      auth.retry();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <div className="auth-card">
        <p className="eyebrow">MỘT KHỞI ĐẦU MỚI</p>
        <h2>{done ? "Đã cập nhật mật khẩu." : "Đặt mật khẩu mới"}</h2>
        <p className="muted">
          {done
            ? "Các phiên đăng nhập cũ đã hết hiệu lực. Hãy đăng nhập bằng mật khẩu mới."
            : "Chọn mật khẩu từ 12 đến 128 ký tự. Liên kết có hiệu lực 30 phút và chỉ dùng một lần."}
        </p>
        <ErrorNotice error={error} />
        {done ? (
          <Link className="button button-primary button-full" to="/login">
            Đăng nhập lại
            <Icon name="arrow" />
          </Link>
        ) : token ? (
          <form onSubmit={submit}>
            <Field label="Mật khẩu mới">
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                disabled={busy}
              />
            </Field>
            <Field label="Nhập lại mật khẩu mới">
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                disabled={busy}
              />
            </Field>
            <button
              className="button button-primary button-full"
              disabled={busy}
            >
              {busy ? "Đang cập nhật…" : "Lưu mật khẩu mới"}
            </button>
          </form>
        ) : (
          <p className="info-notice">Liên kết không có mã khôi phục.</p>
        )}
        <p className="auth-help">
          <Link to="/forgot-password">Yêu cầu liên kết mới</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
