import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";
import AppLayout, { RequireAccount } from "./layouts/AppLayout";
import { LoginPage, SetupPage } from "./pages/AuthPages";
import DashboardPage from "./pages/DashboardPage";
import {
  ClassDetailPage,
  ClassFormPage,
  ClassListPage,
} from "./pages/ClassPages";
import {
  StudentDetailPage,
  StudentFormPage,
  StudentListPage,
} from "./pages/StudentPages";
import { EmptyState, Loading, PageHeader } from "./components/ui";
import InvitationPage, { VerifyEmailPage } from "./pages/InvitationPage";
import { ForgotPasswordPage, ResetPasswordPage } from "./pages/PasswordPages";
import { FamilyHomePage, FamilyChildPage } from "./pages/FamilyPages";
import VerificationPrompt from "./auth/VerificationPrompt";
import GoogleResultPage from "./pages/GoogleResultPage";
import AccountMethodsPanel from "./pages/AccountMethodsPanel";
import AccountStoragePanel from "./pages/AccountStoragePanel";
import PasswordSetupPage from "./pages/PasswordSetupPage";
import FileLibraryPage from "./pages/FilePages";
import {
  AssignmentListPage,
  AssignmentCreatePage,
  AssignmentDetailPage,
} from "./pages/AssignmentPages";
import {
  FamilyLearningPage,
  FamilyAssignmentPage,
  FamilyLessonPage,
} from "./pages/FamilyLearningPages";
import {
  LibraryPage,
  LessonEditorPage,
  CourseEditorPage,
  LibraryDetailPage,
} from "./pages/LibraryPages";

function Home() {
  const { account, loading } = useAuth();
  return loading ? (
    <Loading />
  ) : (
    <Navigate
      to={
        account
          ? account.role === "TEACHER"
            ? "/teacher"
            : "/family"
          : "/login"
      }
      replace
    />
  );
}
function AccountPage() {
  const { account } = useAuth();
  return (
    <>
      <PageHeader
        eyebrow="KHÔNG GIAN CỦA BẠN"
        title={account!.role === "TEACHER" ? "Cài đặt tài khoản" : "Tài khoản"}
        description="Thông tin đăng nhập vào TinyClass."
      />
      <nav className="settings-links" aria-label="Nhóm cài đặt">
        <a href="#profile">Hồ sơ</a>
        <a href="#sign-in-methods">Phương thức đăng nhập</a>
        {account!.role === "TEACHER" && <a href="#storage">Lưu trữ</a>}
      </nav>
      <section id="profile" className="panel details-panel">
        <h2>Hồ sơ</h2>
        <dl>
          <div>
            <dt>Họ và tên</dt>
            <dd>{account!.displayName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{account!.email}</dd>
          </div>
          <div>
            <dt>Xác minh email</dt>
            <dd>
              {account!.emailVerifiedAt ? "Đã xác minh" : "Chưa xác minh"}
            </dd>
          </div>
          <div>
            <dt>Vai trò</dt>
            <dd>{account!.role === "TEACHER" ? "Giáo viên" : "Phụ huynh"}</dd>
          </div>
        </dl>
      </section>
      <div id="sign-in-methods">
        <AccountMethodsPanel />
      </div>
      {account!.role === "TEACHER" && <AccountStoragePanel />}
      {!account!.emailVerifiedAt && (
        <section className="panel family-verification">
          <VerificationPrompt />
        </section>
      )}
    </>
  );
}
function NotFound() {
  return (
    <div className="standalone">
      <EmptyState
        title="Trang này chưa có trong lớp nhỏ"
        icon="search"
        action={
          <Link to="/" className="button button-primary">
            Về trang chính
          </Link>
        }
      >
        Kiểm tra lại đường dẫn hoặc trở về không gian của bạn.
      </EmptyState>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/invite" element={<InvitationPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/set-password" element={<PasswordSetupPage />} />
          <Route path="/auth/google/result" element={<GoogleResultPage />} />
          <Route element={<RequireAccount role="TEACHER" />}>
            <Route path="/teacher" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="classes" element={<ClassListPage />} />
              <Route path="classes/new" element={<ClassFormPage />} />
              <Route path="classes/:id" element={<ClassDetailPage />} />
              <Route path="classes/:id/edit" element={<ClassFormPage />} />
              <Route path="students" element={<StudentListPage />} />
              <Route path="students/new" element={<StudentFormPage />} />
              <Route path="students/:id" element={<StudentDetailPage />} />
              <Route path="students/:id/edit" element={<StudentFormPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="files" element={<FileLibraryPage />} />
              <Route path="assignments" element={<AssignmentListPage />} />
              <Route
                path="assignments/new"
                element={<AssignmentCreatePage />}
              />
              <Route
                path="assignments/:id"
                element={<AssignmentDetailPage />}
              />
              <Route path="library" element={<LibraryPage />} />
              <Route
                path="library/lessons/new"
                element={<LessonEditorPage />}
              />
              <Route
                path="library/lessons/:id/edit"
                element={<LessonEditorPage />}
              />
              <Route
                path="library/lessons/:id"
                element={<LibraryDetailPage type="lessons" />}
              />
              <Route
                path="library/courses/new"
                element={<CourseEditorPage />}
              />
              <Route
                path="library/courses/:id/edit"
                element={<CourseEditorPage />}
              />
              <Route
                path="library/courses/:id"
                element={<LibraryDetailPage type="courses" />}
              />
            </Route>
          </Route>
          <Route element={<RequireAccount role="PARENT" />}>
            <Route path="/family" element={<AppLayout />}>
              <Route index element={<FamilyHomePage />} />
              <Route path="children/:id" element={<FamilyChildPage />} />
              <Route
                path="children/:child/learning"
                element={<FamilyLearningPage />}
              />
              <Route
                path="children/:child/learning/assignments/:assignment"
                element={<FamilyAssignmentPage />}
              />
              <Route
                path="children/:child/learning/items/:item"
                element={<FamilyLessonPage />}
              />
              <Route path="account" element={<AccountPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
