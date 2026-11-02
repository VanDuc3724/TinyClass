import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import GoogleButton from "../auth/GoogleButton";
import { api } from "../lib/api";
import { startGoogle } from "../lib/google";
import { useResource } from "../lib/hooks";
import { ErrorNotice, Field, Icon, Loading, Modal } from "../components/ui";

interface Methods {
  hasPassword: boolean;
  googleEnabled: boolean;
  google: { id: string; email: string | null; linkedAt: string } | null;
  reauthenticated: boolean;
}
type Action = "LINK" | "UNLINK" | "SET_PASSWORD";
export default function AccountMethodsPanel() {
  const auth = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const resource = useResource(
    useCallback((signal) => api.get<Methods>("/auth/methods", signal), []),
  );
  const [pending, setPending] = useState<Action | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState("");
  async function run(action: Action) {
    setBusy(true);
    setError(null);
    try {
      if (action === "LINK") await startGoogle("LINK");
      else if (action === "UNLINK") {
        await api.post(
          `/auth/identities/${resource.data!.google!.id}/unlink`,
          {},
        );
        auth.endSession();
        navigate("/login", { replace: true, state: { methodUnlinked: true } });
      } else {
        await api.post("/auth/password-setup-requests", {});
        setNotice(
          "Đã gửi liên kết thiết lập mật khẩu qua email. Mở trong trình duyệt đang đăng nhập, trong vòng 30 phút.",
        );
        resource.reload();
      }
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  function choose(action: Action) {
    if (!resource.data?.reauthenticated) setPending(action);
    else void run(action);
  }
  return (
    <section className="panel methods-panel">
      <div className="section-heading">
        <div>
          <h2>Phương thức đăng nhập</h2>
          <p className="muted">
            Quản lý cách truy cập tài khoản TinyClass của bạn.
          </p>
        </div>
      </div>
      <div className="panel-inset">
        <ErrorNotice
          error={error || resource.error}
          retry={resource.error ? resource.reload : undefined}
        />
        {notice && (
          <p className="info-notice" role="status">
            {notice}
          </p>
        )}
        {location.state?.googleResult === "LINK" && (
          <p className="info-notice" role="status">
            Đã liên kết Google. Bạn có thể dùng cả hai phương thức với cùng dữ
            liệu.
          </p>
        )}
        {location.state?.googleResult === "REAUTHENTICATE" && (
          <p className="info-notice" role="status">
            Đã xác thực lại bằng Google. Chọn thao tác bạn muốn thực hiện bên
            dưới.
          </p>
        )}
      </div>
      {resource.loading && !resource.data ? (
        <Loading />
      ) : (
        resource.data && (
          <div className="methods-list">
            <div className="method-row">
              <span className="stat-icon mint">
                <Icon name="lock" />
              </span>
              <div>
                <strong>Email và mật khẩu</strong>
                <p>
                  {resource.data.hasPassword
                    ? "Đã có mật khẩu đăng nhập"
                    : "Chưa thiết lập mật khẩu"}
                </p>
              </div>
              {!resource.data.hasPassword && auth.account?.emailVerifiedAt && (
                <button
                  className="button button-small button-ghost"
                  disabled={busy}
                  onClick={() => choose("SET_PASSWORD")}
                >
                  Thêm mật khẩu
                </button>
              )}
            </div>
            <div className="method-row">
              <span className="stat-icon sand google-mark" aria-hidden="true">
                G
              </span>
              <div>
                <strong>Google</strong>
                <p>
                  {resource.data.google
                    ? resource.data.google.email || "Đã liên kết"
                    : resource.data.googleEnabled
                      ? "Chưa liên kết"
                      : "Hiện chưa khả dụng"}
                </p>
              </div>
              {resource.data.google ? (
                resource.data.hasPassword ? (
                  <button
                    className="button button-small button-ghost"
                    disabled={busy}
                    onClick={() => choose("UNLINK")}
                  >
                    Hủy liên kết Google
                  </button>
                ) : (
                  <span className="muted method-hint">
                    Thêm mật khẩu trước khi hủy Google.
                  </span>
                )
              ) : (
                resource.data.googleEnabled && (
                  <button
                    className="button button-small button-ghost"
                    disabled={busy}
                    onClick={() => choose("LINK")}
                  >
                    Liên kết Google
                  </button>
                )
              )}
            </div>
          </div>
        )
      )}
      {pending && resource.data && (
        <ReauthenticationModal
          methods={resource.data}
          onClose={() => setPending(null)}
          onVerified={() => {
            const action = pending;
            setPending(null);
            void run(action);
          }}
        />
      )}
    </section>
  );
}
function ReauthenticationModal({
  methods,
  onClose,
  onVerified,
}: {
  methods: Methods;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/reauthenticate", { password });
      onVerified();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Xác thực lại tài khoản" onClose={onClose} busy={busy}>
      <p className="muted">
        Xác minh bạn là chủ tài khoản trước khi thay đổi phương thức đăng nhập.
        Lần xác thực có hiệu lực 5 phút và dùng cho một thao tác.
      </p>
      <ErrorNotice error={error} />
      {methods.hasPassword && (
        <form onSubmit={submit}>
          <Field label="Mật khẩu hiện tại">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              disabled={busy}
            />
          </Field>
          <button className="button button-primary button-full" disabled={busy}>
            {busy ? "Đang xác thực…" : "Xác nhận mật khẩu"}
          </button>
        </form>
      )}
      {methods.google && methods.googleEnabled && (
        <GoogleButton
          intent="REAUTHENTICATE"
          label="Xác thực lại bằng Google"
        />
      )}
    </Modal>
  );
}
