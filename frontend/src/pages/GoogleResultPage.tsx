import { useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import { AuthLayout } from "./AuthPages";
import { useAuth } from "../auth/useAuth";
import { ErrorNotice, Loading } from "../components/ui";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";

interface GoogleResult {
  status: string;
  code: string;
  nextPath: string;
}
const messages: Record<string, string> = {
  GOOGLE_LOGIN_CANCELLED:
    "Bạn đã hủy đăng nhập Google. Tài khoản hiện tại được giữ nguyên.",
  ACCOUNT_LINK_REQUIRED:
    "Email đã có tài khoản. Hãy đăng nhập bằng phương thức đang có rồi liên kết Google trong trang Tài khoản.",
  INVITATION_REQUIRED:
    "Cần lời mời từ giáo viên để đăng ký tài khoản phụ huynh mới.",
  INVITATION_EMAIL_MISMATCH:
    "Email Google chưa khớp với email nhận lời mời. Hãy chọn đúng tài khoản được mời.",
  INVITATION_UNAVAILABLE:
    "Lời mời không còn hiệu lực. Liên hệ giáo viên để được cấp lại.",
  GOOGLE_ACCOUNT_UNAVAILABLE:
    "Tài khoản chưa thể đăng nhập. Vui lòng liên hệ người quản lý.",
  GOOGLE_IDENTITY_ALREADY_LINKED:
    "Tài khoản Google này đã được liên kết. Hãy kiểm tra phương thức đăng nhập của bạn.",
  GOOGLE_ALREADY_LINKED:
    "Tài khoản đã có một phương thức Google. Kiểm tra trong trang Tài khoản.",
  GOOGLE_REAUTHENTICATION_MISMATCH:
    "Chọn đúng tài khoản Google đã liên kết để xác thực lại.",
  DISPLAY_NAME_REQUIRED:
    "Điền họ và tên trên màn hình lời mời rồi thử đăng ký Google lại.",
  REAUTHENTICATION_REQUIRED:
    "Xác thực lại tài khoản trước khi thay đổi phương thức đăng nhập.",
  MAIL_UNAVAILABLE: "Chưa thể gửi email xác minh. Vui lòng thử lại sau.",
  GOOGLE_CONTEXT_EXPIRED: "Phiên đăng nhập Google đã hết hạn. Hãy bắt đầu lại.",
  GOOGLE_RESULT_EXPIRED:
    "Kết quả xác thực đã hết hạn. Hãy bắt đầu lại từ ứng dụng.",
};
export default function GoogleResultPage() {
  const auth = useAuth();
  const resource = useResource(
    useCallback(
      (signal) => api.get<GoogleResult>("/auth/google/result", signal),
      [],
    ),
  );
  const result = resource.data;
  const next =
    result &&
    (/^\/(teacher|family)(\/[-a-zA-Z0-9_/]*)?$/.test(result.nextPath) ||
      /^\/invite#token=[A-Za-z0-9_-]{43}$/.test(result.nextPath) ||
      result.nextPath === "/login")
      ? result.nextPath
      : "/login";
  if ((resource.loading && !resource.data) || auth.loading)
    return <Loading text="Đang hoàn tất xác thực…" />;
  if (result?.status === "SUCCESS" && auth.account)
    return <Navigate to={next} state={{ googleResult: result.code }} replace />;
  return (
    <AuthLayout>
      <div className="auth-card">
        <p className="eyebrow">XÁC THỰC TÀI KHOẢN</p>
        <h2>Chưa thể hoàn tất với Google.</h2>
        <ErrorNotice error={resource.error} retry={resource.reload} />
        <p className="muted">
          {messages[result?.code || ""] ||
            "Không thể xác minh đăng nhập Google. Hãy thử lại từ ứng dụng."}
        </p>
        <Link to={next} className="button button-primary button-full">
          Trở lại để tiếp tục
        </Link>
      </div>
    </AuthLayout>
  );
}
