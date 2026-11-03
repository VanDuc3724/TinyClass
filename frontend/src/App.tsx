import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";
import AppLayout, { RequireAccount } from "./layouts/AppLayout";
import { LoginPage, SetupPage } from "./pages/AuthPages";
import DashboardPage from "./pages/DashboardPage";
import AttendanceWorkspacePage from "./pages/AttendanceWorkspace";
import {
  CalendarPage,
  NewSessionPage,
  SessionDetailPage,
} from "./pages/SchedulePages";
import { ScheduleRulesPage } from "./pages/ScheduleRulePages";
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
import {
  ReviewListPage,
  ReviewDetailPage,
  RecipientProgressPage,
  FamilySubmissionListPage,
  FamilySubmissionDetailPage,
} from "./pages/SubmissionPages";
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

const StudentProgressPage = lazy(() => import("./pages/StudentProgressPages"));
const NotificationPage = lazy(() => import("./pages/NotificationPage"));
const AnnouncementListPage = lazy(() =>
  import("./pages/AnnouncementPages").then((module) => ({
    default: module.AnnouncementListPage,
  })),
);
const AnnouncementDetailPage = lazy(() =>
  import("./pages/AnnouncementPages").then((module) => ({
    default: module.AnnouncementDetailPage,
  })),
);
const InvoiceEditorPage = lazy(() => import("./pages/InvoiceEditor"));
const InvoiceListPage = lazy(() =>
  import("./pages/InvoicePages").then((module) => ({
    default: module.InvoiceListPage,
  })),
);
const InvoiceDetailPage = lazy(() =>
  import("./pages/InvoicePages").then((module) => ({
    default: module.InvoiceDetailPage,
  })),
);
const FamilyInvoiceListPage = lazy(() =>
  import("./pages/InvoicePages").then((module) => ({
    default: module.FamilyInvoiceListPage,
  })),
);
const FamilyInvoiceDetailPage = lazy(() =>
  import("./pages/InvoicePages").then((module) => ({
    default: module.FamilyInvoiceDetailPage,
  })),
);
const FamilyAttendancePage = lazy(() =>
  import("./pages/AttendancePages").then((module) => ({
    default: module.FamilyAttendancePage,
  })),
);
const TeacherAttendancePage = lazy(() =>
  import("./pages/AttendancePages").then((module) => ({
    default: module.TeacherAttendancePage,
  })),
);
const EnrollmentTuitionPage = lazy(() =>
  import("./pages/TuitionPages").then((module) => ({
    default: module.EnrollmentTuitionPage,
  })),
);
const FamilyTuitionPage = lazy(() =>
  import("./pages/TuitionPages").then((module) => ({
    default: module.FamilyTuitionPage,
  })),
);
function ProgressRoute({ family = false }: { family?: boolean }) {
  return (
    <Suspense fallback={<Loading />}>
      <StudentProgressPage family={family} />
    </Suspense>
  );
}

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
              <Route
                path="invoices"
                element={
                  <Suspense fallback={<Loading />}>
                    <InvoiceListPage />
                  </Suspense>
                }
              />
              <Route
                path="invoices/new"
                element={
                  <Suspense fallback={<Loading />}>
                    <InvoiceEditorPage />
                  </Suspense>
                }
              />
              <Route
                path="invoices/:invoice"
                element={
                  <Suspense fallback={<Loading />}>
                    <InvoiceDetailPage />
                  </Suspense>
                }
              />
              <Route
                path="invoices/:invoice/edit"
                element={
                  <Suspense fallback={<Loading />}>
                    <InvoiceEditorPage />
                  </Suspense>
                }
              />
              <Route path="classes" element={<ClassListPage />} />
              <Route path="classes/new" element={<ClassFormPage />} />
              <Route path="classes/:id" element={<ClassDetailPage />} />
              <Route path="classes/:id/edit" element={<ClassFormPage />} />
              <Route
                path="classes/:id/schedule-rules"
                element={<ScheduleRulesPage />}
              />
              <Route
                path="updates"
                element={
                  <Suspense fallback={<Loading />}>
                    <NotificationPage />
                  </Suspense>
                }
              />
              <Route
                path="announcements"
                element={
                  <Suspense fallback={<Loading />}>
                    <AnnouncementListPage />
                  </Suspense>
                }
              />
              <Route
                path="announcements/:announcement"
                element={
                  <Suspense fallback={<Loading />}>
                    <AnnouncementDetailPage />
                  </Suspense>
                }
              />
              <Route path="schedule" element={<CalendarPage />} />
              <Route
                path="attendance"
                element={
                  <Suspense fallback={<Loading />}>
                    <TeacherAttendancePage />
                  </Suspense>
                }
              />
              <Route
                path="enrollments/:enrollment/tuition"
                element={
                  <Suspense fallback={<Loading />}>
                    <EnrollmentTuitionPage />
                  </Suspense>
                }
              />
              <Route
                path="sessions/:session/attendance"
                element={<AttendanceWorkspacePage />}
              />
              <Route path="schedule/new" element={<NewSessionPage />} />
              <Route
                path="schedule/sessions/:id"
                element={<SessionDetailPage />}
              />
              <Route path="students" element={<StudentListPage />} />
              <Route path="students/new" element={<StudentFormPage />} />
              <Route path="students/:id" element={<StudentDetailPage />} />
              <Route
                path="students/:child/progress"
                element={<ProgressRoute />}
              />
              <Route path="students/:id/edit" element={<StudentFormPage />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="files" element={<FileLibraryPage />} />
              <Route path="assignments" element={<AssignmentListPage />} />
              <Route path="reviews" element={<ReviewListPage />} />
              <Route path="reviews/:id" element={<ReviewDetailPage />} />
              <Route
                path="assignments/:assignment/children/:child"
                element={<RecipientProgressPage />}
              />
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
              <Route
                path="updates"
                element={
                  <Suspense fallback={<Loading />}>
                    <NotificationPage />
                  </Suspense>
                }
              />
              <Route
                path="children/:child/announcements"
                element={
                  <Suspense fallback={<Loading />}>
                    <AnnouncementListPage family />
                  </Suspense>
                }
              />
              <Route
                path="children/:child/announcements/:announcement"
                element={
                  <Suspense fallback={<Loading />}>
                    <AnnouncementDetailPage family />
                  </Suspense>
                }
              />
              <Route
                path="children/:child/invoices"
                element={
                  <Suspense fallback={<Loading />}>
                    <FamilyInvoiceListPage />
                  </Suspense>
                }
              />
              <Route
                path="children/:child/invoices/:invoice"
                element={
                  <Suspense fallback={<Loading />}>
                    <FamilyInvoiceDetailPage />
                  </Suspense>
                }
              />
              <Route path="children/:id" element={<FamilyChildPage />} />
              <Route
                path="children/:child/progress"
                element={<ProgressRoute family />}
              />
              <Route
                path="children/:child/attendance"
                element={
                  <Suspense fallback={<Loading />}>
                    <FamilyAttendancePage />
                  </Suspense>
                }
              />
              <Route
                path="children/:child/tuition"
                element={
                  <Suspense fallback={<Loading />}>
                    <FamilyTuitionPage />
                  </Suspense>
                }
              />
              <Route
                path="children/:child/schedule"
                element={<CalendarPage family />}
              />
              <Route
                path="children/:child/submissions"
                element={<FamilySubmissionListPage />}
              />
              <Route
                path="children/:child/submissions/:submission"
                element={<FamilySubmissionDetailPage />}
              />
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
