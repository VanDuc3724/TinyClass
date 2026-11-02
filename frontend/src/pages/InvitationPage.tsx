import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import VerificationPrompt from "../auth/VerificationPrompt";
import GoogleButton from "../auth/GoogleButton";
import { Brand, ErrorNotice, Field, Icon, Loading } from "../components/ui";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import { AuthLayout } from "./AuthPages";

function useLinkSecrets() {
  const location = useLocation(),
    navigate = useNavigate();
  const [secrets] = useState(() => new URLSearchParams(location.hash.slice(1)));
  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);
  return {
    token: secrets.get("token") || "",
    invitation: secrets.get("invitation") || "",
  };
}
interface Preview {
  teacherName: string | null;
  maskedEmail: string | null;
  status: string;
}
export default function InvitationPage() {
  const { token } = useLinkSecrets();
  const auth = useAuth(),
    navigate = useNavigate();
  const resource = useResource(
    useCallback(
      (signal) =>
        token
          ? api.post<Preview>("/auth/invitations/preview", { token }, signal)
          : Promise.resolve(null),
      [token],
    ),
  );
  const [mode, setMode] = useState("register"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const [googleName, setGoogleName] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email")).trim(),
      password = String(values.get("password"));
    setBusy(true);
    setError(null);
    try {
      if (mode === "register")
        await api.post("/auth/register", {
          displayName: values.get("displayName"),
          email,
          password,
          invitationToken: token,
        });
      await auth.login(email, password);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = String(
      new FormData(event.currentTarget).get("relationshipLabel") || "",
    );
    setBusy(true);
    setError(null);
    try {
      const accepted = await api.post<{ studentId: string }>(
        "/guardian-invitations/accept",
        { token, relationshipLabel: label },
      );
      navigate(`/family/children/${accepted.studentId}`, { replace: true });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  const usable = resource.data?.status === "PENDING";
  return (
    <AuthLayout>
      <div className="auth-card invitation-card">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <p className="eyebrow">CÙNG CON BẮT ĐẦU</p>
        <h2>Một lời mời từ lớp nhỏ.</h2>
        {(resource.loading && !resource.data) || auth.loading ? (
          <Loading />
        ) : (
          <>
            <ErrorNotice error={resource.error} retry={resource.reload} />
            {!token || (!resource.error && !usable) ? (
              <>
                <p className="info-notice">
                  Lời mời không còn hiệu lực, đã được nhận hoặc thiếu liên kết.
                  Liên hệ giáo viên để được cấp lời mời mới.
                </p>
                <Link
                  className="button button-ghost"
                  to={auth.account ? "/" : "/login"}
                >
                  Về không gian của tôi
                </Link>
              </>
            ) : (
              resource.data && (
                <>
                  <p className="muted">
                    <strong>{resource.data.teacherName}</strong> mời gia đình sử
                    dụng TinyClass. Lời mời dành cho{" "}
                    <strong>{resource.data.maskedEmail}</strong>.
                  </p>
                  <ErrorNotice error={error} />
                  {!auth.account ? (
                    <>
                      <div className="auth-mode-tabs">
                        <button
                          className={mode === "register" ? "active" : ""}
                          onClick={() => {
                            setMode("register");
                            setError(null);
                          }}
                        >
                          Tạo tài khoản
                        </button>
                        <button
                          className={mode === "login" ? "active" : ""}
                          onClick={() => {
                            setMode("login");
                            setError(null);
                          }}
                        >
                          Đã có tài khoản
                        </button>
                      </div>
                      <form onSubmit={submit}>
                        <fieldset disabled={busy}>
                          {mode === "register" && (
                            <Field label="Họ và tên phụ huynh">
                              <input
                                name="displayName"
                                onChange={(event) =>
                                  setGoogleName(event.target.value)
                                }
                                required
                                maxLength={100}
                                autoComplete="name"
                              />
                            </Field>
                          )}
                          <Field label="Địa chỉ email">
                            <input
                              name="email"
                              type="email"
                              required
                              maxLength={254}
                              autoComplete="username"
                              placeholder="Email nhận lời mời của bạn"
                            />
                          </Field>
                          <Field
                            label="Mật khẩu"
                            hint={
                              mode === "register"
                                ? "Từ 12 đến 128 ký tự."
                                : undefined
                            }
                          >
                            <input
                              name="password"
                              type="password"
                              required
                              minLength={mode === "register" ? 12 : 1}
                              maxLength={128}
                              autoComplete={
                                mode === "register"
                                  ? "new-password"
                                  : "current-password"
                              }
                            />
                          </Field>
                          <button
                            className="button button-primary button-full"
                            disabled={busy}
                          >
                            {busy
                              ? "Đang xử lý…"
                              : mode === "register"
                                ? "Tạo tài khoản phụ huynh"
                                : "Đăng nhập để tiếp tục"}
                            <Icon name="arrow" />
                          </button>
                        </fieldset>
                      </form>
                      <GoogleButton
                        intent={mode === "register" ? "REGISTER" : "LOGIN"}
                        invitationToken={token}
                        displayName={googleName || undefined}
                      />
                      <p className="auth-help">
                        <Link to="/forgot-password">Quên mật khẩu?</Link>
                      </p>
                    </>
                  ) : auth.account.role !== "PARENT" ? (
                    <>
                      <p className="info-notice">
                        Bạn đang dùng tài khoản giáo viên. Đăng xuất và dùng
                        đúng email phụ huynh nhận lời mời để tiếp tục.
                      </p>
                      <button
                        className="button button-ghost"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await auth.logout();
                          } catch (failure) {
                            setError(failure);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Đăng xuất tài khoản hiện tại
                      </button>
                    </>
                  ) : !auth.account.emailVerifiedAt ? (
                    <VerificationPrompt invitationToken={token} />
                  ) : (
                    <form onSubmit={accept}>
                      <p className="info-notice">
                        Bạn đang đăng nhập bằng {auth.account.email}. Hồ sơ bé
                        sẽ được hiển thị sau khi nhận đúng lời mời.
                      </p>
                      <Field label="Mối quan hệ với bé" optional>
                        <input
                          name="relationshipLabel"
                          maxLength={50}
                          placeholder="Ví dụ: Mẹ, Ba, Người giám hộ"
                          disabled={busy}
                        />
                      </Field>
                      <button
                        className="button button-primary button-full"
                        disabled={busy}
                      >
                        {busy ? "Đang kết nối…" : "Nhận lời mời"}
                        <Icon name="arrow" />
                      </button>
                    </form>
                  )}
                </>
              )
            )}
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const { token, invitation } = useLinkSecrets();
  const auth = useAuth();
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function verify() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/email-verifications/confirm", { token });
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
        <p className="eyebrow">MỘT BƯỚC ĐỂ AN TÂM</p>
        <h2>{done ? "Email đã được xác minh." : "Xác minh địa chỉ email"}</h2>
        <p className="muted">
          {done
            ? "Bạn có thể tiếp tục nhận lời mời và đồng hành cùng bé."
            : "Xác nhận để TinyClass biết đây là email của bạn. Liên kết chỉ dùng được một lần."}
        </p>
        <ErrorNotice error={error} />
        {done ? (
          <Link
            className="button button-primary button-full"
            to={invitation ? `/invite#token=${invitation}` : "/"}
          >
            {invitation ? "Tiếp tục lời mời" : "Về không gian của tôi"}
            <Icon name="arrow" />
          </Link>
        ) : token ? (
          <button
            className="button button-primary button-full"
            disabled={busy}
            onClick={verify}
          >
            {busy ? "Đang xác minh…" : "Xác minh email"}
          </button>
        ) : (
          <p className="info-notice">
            Thiếu liên kết xác minh. Đăng nhập để yêu cầu email mới.
          </p>
        )}
        <p className="auth-help">
          <Link to="/login">Về trang đăng nhập</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
