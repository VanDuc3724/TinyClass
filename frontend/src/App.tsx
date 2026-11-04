import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";
import AppLayout, { RequireAccount } from "./layouts/AppLayout";
import { LoginPage, SetupPage } from "./pages/AuthPages";
import { EmptyState, Loading, PageHeader } from "./components/ui";
import VerificationPrompt from "./auth/VerificationPrompt";

// Login stays in the entry bundle; every other screen downloads its own chunk on first visit.
function lazyPage<K extends string, M extends Record<K, ComponentType<any>>>(
  load: () => Promise<M>,
  name: K,
) {
  return lazy(async () => ({ default: (await load())[name] }));
}
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AttendanceWorkspacePage = lazy(
  () => import("./pages/AttendanceWorkspace"),
);
const CalendarPage = lazyPage(
  () => import("./pages/SchedulePages"),
  "CalendarPage",
);
const NewSessionPage = lazyPage(
  () => import("./pages/SchedulePages"),
  "NewSessionPage",
);
const SessionDetailPage = lazyPage(
  () => import("./pages/SchedulePages"),
  "SessionDetailPage",
);
const ScheduleRulesPage = lazyPage(
  () => import("./pages/ScheduleRulePages"),
  "ScheduleRulesPage",
);
const ClassListPage = lazyPage(
  () => import("./pages/ClassPages"),
  "ClassListPage",
);
const ClassFormPage = lazyPage(
  () => import("./pages/ClassPages"),
  "ClassFormPage",
);
const ClassDetailPage = lazyPage(
  () => import("./pages/ClassPages"),
  "ClassDetailPage",
);
const StudentListPage = lazyPage(
  () => import("./pages/StudentPages"),
  "StudentListPage",
);
const StudentFormPage = lazyPage(
  () => import("./pages/StudentPages"),
  "StudentFormPage",
);
const StudentDetailPage = lazyPage(
  () => import("./pages/StudentPages"),
  "StudentDetailPage",
);
const InvitationPage = lazy(() => import("./pages/InvitationPage"));
const VerifyEmailPage = lazyPage(
  () => import("./pages/InvitationPage"),
  "VerifyEmailPage",
);
const ForgotPasswordPage = lazyPage(
  () => import("./pages/PasswordPages"),
  "ForgotPasswordPage",
);
const ResetPasswordPage = lazyPage(
  () => import("./pages/PasswordPages"),
  "ResetPasswordPage",
);
const PasswordSetupPage = lazy(() => import("./pages/PasswordSetupPage"));
const GoogleResultPage = lazy(() => import("./pages/GoogleResultPage"));
const AccountMethodsPanel = lazy(() => import("./pages/AccountMethodsPanel"));
const AccountStoragePanel = lazy(() => import("./pages/AccountStoragePanel"));
const FamilyHomePage = lazyPage(
  () => import("./pages/FamilyPages"),
  "FamilyHomePage",
);
const FamilyChildPage = lazyPage(
  () => import("./pages/FamilyPages"),
  "FamilyChildPage",
);
const ReviewListPage = lazyPage(
  () => import("./pages/SubmissionPages"),
  "ReviewListPage",
);
const ReviewDetailPage = lazyPage(
  () => import("./pages/SubmissionPages"),
  "ReviewDetailPage",
);
const RecipientProgressPage = lazyPage(
  () => import("./pages/SubmissionPages"),
  "RecipientProgressPage",
);
const FamilySubmissionListPage = lazyPage(
  () => import("./pages/SubmissionPages"),
  "FamilySubmissionListPage",
);
const FamilySubmissionDetailPage = lazyPage(
  () => import("./pages/SubmissionPages"),
  "FamilySubmissionDetailPage",
);
const FileLibraryPage = lazy(() => import("./pages/FilePages"));
const AssignmentListPage = lazyPage(
  () => import("./pages/AssignmentPages"),
  "AssignmentListPage",
);
const AssignmentCreatePage = lazyPage(
  () => import("./pages/AssignmentPages"),
  "AssignmentCreatePage",
);
const AssignmentDetailPage = lazyPage(
  () => import("./pages/AssignmentPages"),
  "AssignmentDetailPage",
);
const FamilyLearningPage = lazyPage(
  () => import("./pages/FamilyLearningPages"),
  "FamilyLearningPage",
);
const FamilyAssignmentPage = lazyPage(
  () => import("./pages/FamilyLearningPages"),
  "FamilyAssignmentPage",
);
const FamilyLessonPage = lazyPage(
  () => import("./pages/FamilyLearningPages"),
  "FamilyLessonPage",
);
const LibraryPage = lazyPage(() => import("./pages/LibraryPages"), "LibraryPage");
const LessonEditorPage = lazyPage(
  () => import("./pages/LibraryPages"),
  "LessonEditorPage",
);
const CourseEditorPage = lazyPage(
  () => import("./pages/LibraryPages"),
  "CourseEditorPage",
);
const LibraryDetailPage = lazyPage(
  () => import("./pages/LibraryPages"),
  "LibraryDetailPage",
);
const StudentProgressPage = lazy(() => import("./pages/StudentProgressPages"));
const NotificationPage = lazy(() => import("./pages/NotificationPage"));
const AnnouncementListPage = lazyPage(
  () => import("./pages/AnnouncementPages"),
  "AnnouncementListPage",
);
const AnnouncementDetailPage = lazyPage(
  () => import("./pages/AnnouncementPages"),
  "AnnouncementDetailPage",
);
const InvoiceEditorPage = lazy(() => import("./pages/InvoiceEditor"));
const InvoiceListPage = lazyPage(
  () => import("./pages/InvoicePages"),
  "InvoiceListPage",
);
const InvoiceDetailPage = lazyPage(
  () => import("./pages/InvoicePages"),
  "InvoiceDetailPage",
);
const FamilyInvoiceListPage = lazyPage(
  () => import("./pages/InvoicePages"),
  "FamilyInvoiceListPage",
);
const FamilyInvoiceDetailPage = lazyPage(
  () => import("./pages/InvoicePages"),
  "FamilyInvoiceDetailPage",
);
const FamilyAttendancePage = lazyPage(
  () => import("./pages/AttendancePages"),
  "FamilyAttendancePage",
);
const TeacherAttendancePage = lazyPage(
  () => import("./pages/AttendancePages"),
  "TeacherAttendancePage",
);
const EnrollmentTuitionPage = lazyPage(
  () => import("./pages/TuitionPages"),
  "EnrollmentTuitionPage",
);
const FamilyTuitionPage = lazyPage(
  () => import("./pages/TuitionPages"),
  "FamilyTuitionPage",
);

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
        <Suspense fallback={<Loading />}>
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
                <Route path="invoices" element={<InvoiceListPage />} />
                <Route path="invoices/new" element={<InvoiceEditorPage />} />
                <Route
                  path="invoices/:invoice"
                  element={<InvoiceDetailPage />}
                />
                <Route
                  path="invoices/:invoice/edit"
                  element={<InvoiceEditorPage />}
                />
                <Route path="classes" element={<ClassListPage />} />
                <Route path="classes/new" element={<ClassFormPage />} />
                <Route path="classes/:id" element={<ClassDetailPage />} />
                <Route path="classes/:id/edit" element={<ClassFormPage />} />
                <Route
                  path="classes/:id/schedule-rules"
                  element={<ScheduleRulesPage />}
                />
                <Route path="updates" element={<NotificationPage />} />
                <Route path="announcements" element={<AnnouncementListPage />} />
                <Route
                  path="announcements/:announcement"
                  element={<AnnouncementDetailPage />}
                />
                <Route path="schedule" element={<CalendarPage />} />
                <Route path="attendance" element={<TeacherAttendancePage />} />
                <Route
                  path="enrollments/:enrollment/tuition"
                  element={<EnrollmentTuitionPage />}
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
                  element={<StudentProgressPage />}
                />
                <Route
                  path="students/:id/edit"
                  element={<StudentFormPage />}
                />
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
                <Route path="updates" element={<NotificationPage />} />
                <Route
                  path="children/:child/announcements"
                  element={<AnnouncementListPage family />}
                />
                <Route
                  path="children/:child/announcements/:announcement"
                  element={<AnnouncementDetailPage family />}
                />
                <Route
                  path="children/:child/invoices"
                  element={<FamilyInvoiceListPage />}
                />
                <Route
                  path="children/:child/invoices/:invoice"
                  element={<FamilyInvoiceDetailPage />}
                />
                <Route path="children/:id" element={<FamilyChildPage />} />
                <Route
                  path="children/:child/progress"
                  element={<StudentProgressPage family />}
                />
                <Route
                  path="children/:child/attendance"
                  element={<FamilyAttendancePage />}
                />
                <Route
                  path="children/:child/tuition"
                  element={<FamilyTuitionPage />}
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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
