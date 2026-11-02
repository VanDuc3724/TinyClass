import { useCallback, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  Brand,
  ErrorNotice,
  Field,
  ReadingElephant,
  Icon,
  Loading,
} from "../components/ui";
import { api, clearCsrf } from "../lib/api";
import { useResource } from "../lib/hooks";
import GoogleButton from "../auth/GoogleButton";
import styles from "./AuthPages.module.css";

interface SetupStatus {
  setupRequired: boolean;
  setupEnabled: boolean;
}
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.layout}>
      <section className={styles.story}>
        <Brand />
        <div className={styles.storyContent}>
          <p className="eyebrow">MỘT GÓC NHỎ, NHIỀU YÊU THƯƠNG</p>
          <h1>
            Chăm chút lớp nhỏ,
            <br />
            ươm những điều lớn.
          </h1>
          <p>
            Giữ lớp học ngăn nắp, để bạn có thêm thời gian đồng hành cùng từng
            bé.
          </p>
          <ReadingElephant className={styles.mascot} />
          <div className="story-features">
            <span>
              <Icon name="classes" />
              Lớp học gọn gàng
            </span>
            <span>
              <Icon name="students" />
              Mỗi bé một hành trình
            </span>
          </div>
        </div>
        <small>TinyClass · Không gian dạy học tại nhà</small>
      </section>
      <section className={styles.main}>{children}</section>
    </div>
  );
}
export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const status = useResource(
    useCallback(
      (signal) => api.get<SetupStatus>("/auth/setup-status", signal),
      [],
    ),
  );
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  if (auth.account)
    return (
      <Navigate
        to={auth.account.role === "TEACHER" ? "/teacher" : "/family"}
        replace
      />
    );
  if (status.data?.setupRequired && status.data.setupEnabled)
    return <Navigate to="/setup" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const account = await auth.login(
        String(values.get("email")).trim(),
        String(values.get("password")),
      );
      const root = account.role === "TEACHER" ? "/teacher" : "/family";
      const from = location.state?.from;
      navigate(
        typeof from === "string" &&
          (from === root || from.startsWith(`${root}/`))
          ? from
          : root,
        { replace: true },
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <span className="welcome-icon">
          <Icon name="leaf" />
        </span>
        <p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p>
        <h2>Một ngày mới cùng TinyClass.</h2>
        <p className="muted">Đăng nhập để tiếp tục chăm sóc lớp học của bạn.</p>
        {auth.expired && (
          <p className="info-notice" role="status">
            Phiên làm việc đã kết thúc. Vui lòng đăng nhập lại.
          </p>
        )}
        {location.state?.setupComplete && (
          <p className="info-notice" role="status">
            Đã tạo tài khoản giáo viên. Bạn có thể đăng nhập ngay.
          </p>
        )}
        {location.state?.methodUnlinked && (
          <p className="info-notice" role="status">
            Đã hủy liên kết Google. Đăng nhập lại bằng phương thức còn lại.
          </p>
        )}
        <ErrorNotice error={status.error} retry={status.reload} />
        <ErrorNotice error={error} />
        {status.data?.setupRequired && !status.data.setupEnabled && (
          <p className="info-notice">
            Chưa có tài khoản giáo viên. Người cài đặt cần cấp mã khởi tạo để
            bắt đầu.
          </p>
        )}
        <form onSubmit={submit}>
          <Field label="Địa chỉ email">
            <input
              name="email"
              type="email"
              autoComplete="username"
              placeholder="ban@example.com"
              required
              maxLength={254}
              disabled={busy}
            />
          </Field>
          <Field label="Mật khẩu">
            <span className="password-field">
              <input
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu của bạn"
                required
                maxLength={128}
                disabled={busy}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                aria-pressed={show}
                onClick={() => setShow(!show)}
              >
                <Icon name="eye" />
              </button>
            </span>
          </Field>
          <button
            className="button button-primary button-full"
            disabled={busy || status.loading}
          >
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            <Icon name="arrow" />
          </button>
        </form>
        <GoogleButton />
        <p className="auth-help">
          <Link to="/forgot-password">Quên mật khẩu?</Link>
        </p>
        <p className="auth-help">
          Bạn là phụ huynh? Hãy sử dụng lời mời từ giáo viên để bắt đầu.
        </p>
      </div>
    </AuthLayout>
  );
}
export function SetupPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const status = useResource(
    useCallback(
      (signal) => api.get<SetupStatus>("/auth/setup-status", signal),
      [],
    ),
  );
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (auth.account) return <Navigate to="/" replace />;
  if (status.loading && !status.data) return <Loading />;
  if (status.data && !status.data.setupRequired)
    return <Navigate to="/login" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/setup", values);
      clearCsrf();
      navigate("/login", { replace: true, state: { setupComplete: true } });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <p className="eyebrow">BẮT ĐẦU HÀNH TRÌNH</p>
        <h2>Lớp nhỏ của bạn, sẵn sàng.</h2>
        <p className="muted">
          Tạo tài khoản giáo viên duy nhất để quản lý không gian TinyClass này.
        </p>
        <ErrorNotice error={status.error} retry={status.reload} />
        <ErrorNotice error={error} />
        <form onSubmit={submit}>
          <Field label="Tên giáo viên">
            <input
              name="displayName"
              autoComplete="name"
              required
              maxLength={100}
              placeholder="Bạn muốn được gọi là gì?"
              disabled={busy}
            />
          </Field>
          <Field label="Địa chỉ email">
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              placeholder="ban@example.com"
              disabled={busy}
            />
          </Field>
          <Field label="Mật khẩu" hint="Từ 12 đến 128 ký tự.">
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              disabled={busy}
            />
          </Field>
          <Field
            label="Mã khởi tạo"
            hint="Mã riêng do người cài đặt hệ thống cung cấp."
          >
            <input
              name="setupKey"
              type="password"
              autoComplete="off"
              required
              maxLength={256}
              disabled={busy}
            />
          </Field>
          <button
            className="button button-primary button-full"
            disabled={busy || !status.data?.setupEnabled}
          >
            {busy ? "Đang khởi tạo…" : "Tạo không gian của tôi"}
            <Icon name="arrow" />
          </button>
        </form>
        <p className="auth-help">
          <Link to="/login">Trở về đăng nhập</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
