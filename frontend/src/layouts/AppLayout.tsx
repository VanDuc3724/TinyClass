import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  Avatar,
  Brand,
  ErrorNotice,
  Icon,
  Loading,
  ReadingElephant,
} from "../components/ui";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import { trapDialogFocus } from "../lib/accessibility";
import styles from "./AppLayout.module.css";
import NotificationBell from "../components/NotificationBell";

export function RequireAccount({ role }: { role: "TEACHER" | "PARENT" }) {
  const auth = useAuth(),
    location = useLocation();
  if (auth.loading) return <Loading text="Đang mở không gian của bạn…" />;
  if (auth.error)
    return (
      <div className="standalone">
        <ErrorNotice error={auth.error} retry={auth.retry} />
      </div>
    );
  if (!auth.account)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (auth.account.role !== role)
    return (
      <Navigate
        to={auth.account.role === "TEACHER" ? "/teacher" : "/family"}
        replace
      />
    );
  return <Outlet />;
}
interface ChildChoice {
  id: string;
  fullName: string;
  preferredName: string | null;
}
export default function AppLayout() {
  const { account, logout } = useAuth();
  const location = useLocation(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [today] = useState(() => new Date());
  const [desktop, setDesktop] = useState(
    () => window.matchMedia("(min-width: 1200px)").matches,
  );
  const drawer = useRef<HTMLDialogElement>(null),
    menuButton = useRef<HTMLButtonElement>(null);
  const accountMenu = useRef<HTMLDetailsElement>(null);
  const teacher = account!.role === "TEACHER",
    root = teacher ? "/teacher" : "/family";
  const verified = !!account!.emailVerifiedAt,
    accountId = account!.id;
  const routeChild = location.pathname.match(
    /^\/family\/children\/([^/]+)/,
  )?.[1];
  const [rememberedChild, setRememberedChild] = useState("");
  const children = useResource(
    useCallback(
      async (signal) => {
        if (!accountId || teacher || !verified) return [];
        const result: ChildChoice[] = [];
        for (let page = 0; ; page++) {
          const response = await api.list<ChildChoice>(
            `/family/children?page=${page}&size=100`,
            signal,
          );
          result.push(...response.data);
          if (page + 1 >= response.meta.totalPages) break;
        }
        return result;
      },
      [teacher, verified, accountId],
    ),
  );
  const selectedChild =
    routeChild ||
    (children.data?.some((c) => c.id === rememberedChild)
      ? rememberedChild
      : children.data?.[0]?.id);
  const learningLink = selectedChild
    ? `/family/children/${selectedChild}/learning`
    : "/family";
  const child = children.data?.find((c) => c.id === selectedChild);
  const studying = !teacher && /\/learning\/items\//.test(location.pathname);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1200px)");
    const resize = () => {
      setDesktop(query.matches);
      if (query.matches) setOpen(false);
    };
    query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (!open || desktop) return;
    const element = drawer.current,
      trigger = menuButton.current,
      previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open, desktop]);
  useEffect(() => {
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        if (accountMenu.current?.open) {
          accountMenu.current.open = false;
          accountMenu.current.querySelector("summary")?.focus();
        }
      } else if (
        event instanceof PointerEvent &&
        !accountMenu.current?.contains(event.target as Node)
      ) {
        if (accountMenu.current) accountMenu.current.open = false;
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, []);
  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await logout();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  function changeChild(id: string) {
    setRememberedChild(id);
    // Stay in the same section for the other child; detail pages fall back to that section's list.
    const section =
      [
        "/learning",
        "/schedule",
        "/attendance",
        "/progress",
        "/tuition",
        "/invoices",
        "/announcements",
        "/submissions",
      ].find((path) => location.pathname.includes(path)) || "";
    navigate(`/family/children/${id}${section}`);
  }
  const navigation = (
    <>
      <div className={styles.brandRow}>
        <Link to={root} onClick={() => setOpen(false)}>
          <Brand />
        </Link>
        {!desktop && (
          <button
            className={`icon-button ${styles.drawerClose}`}
            onClick={() => setOpen(false)}
            aria-label="Đóng menu"
          >
            <Icon name="close" />
          </button>
        )}
      </div>
      <span className={styles.workspacePill}>
        <span />
        {teacher ? "Góc giáo viên" : "Góc gia đình"}
      </span>
      <nav
        className={styles.navigation}
        aria-label="Điều hướng chính"
        onClick={() => setOpen(false)}
      >
        <NavLink to={root} end>
          <Icon name="home" />
          {teacher ? "Tổng quan" : "Trang chủ"}
        </NavLink>
        <NavLink to={`${root}/updates`}>
          <Icon name="clock" />
          Cập nhật của bạn
        </NavLink>
        {/* Groups follow how often each task comes up: daily work first, monthly billing last. */}
        {teacher ? (
          <>
            <p className={styles.groupLabel}>GIẢNG DẠY</p>
            <NavLink to="/teacher/schedule">
              <Icon name="calendar" />
              Lịch dạy
            </NavLink>
            <NavLink to="/teacher/attendance">
              <Icon name="check" />
              Điểm danh
            </NavLink>
            <NavLink to="/teacher/reviews">
              <Icon name="message" />
              Phản hồi
            </NavLink>
            <p className={styles.groupLabel}>LỚP HỌC</p>
            <NavLink to="/teacher/classes">
              <Icon name="classes" />
              Lớp học
            </NavLink>
            <NavLink to="/teacher/students">
              <Icon name="students" />
              Học sinh
            </NavLink>
            <NavLink to="/teacher/announcements">
              <Icon name="megaphone" />
              Thông báo lớp
            </NavLink>
            <p className={styles.groupLabel}>HỌC LIỆU</p>
            <NavLink to="/teacher/library">
              <Icon name="book" />
              Thư viện học liệu
            </NavLink>
            <NavLink to="/teacher/assignments">
              <Icon name="arrow" />
              Giao bài
            </NavLink>
            <NavLink to="/teacher/files">
              <Icon name="upload" />
              Kho tài liệu
            </NavLink>
            <p className={styles.groupLabel}>HỌC PHÍ</p>
            <NavLink to="/teacher/invoices">
              <Icon name="receipt" />
              Phiếu học phí
            </NavLink>
          </>
        ) : (
          <>
            <NavLink
              to={
                selectedChild
                  ? `/family/children/${selectedChild}/announcements`
                  : "/family"
              }
            >
              <Icon name="megaphone" />
              Thông báo lớp
            </NavLink>
            <p className={styles.groupLabel}>HỌC TẬP</p>
            <NavLink
              to={learningLink}
              className={
                location.pathname.includes("/learning") ? "active" : ""
              }
            >
              <Icon name="book" />
              Bài của con
            </NavLink>
            {selectedChild && (
              <NavLink to={`/family/children/${selectedChild}/submissions`}>
                <Icon name="message" />
                Sản phẩm & phản hồi
              </NavLink>
            )}
            {selectedChild && (
              <NavLink to={`/family/children/${selectedChild}/progress`}>
                <Icon name="leaf" />
                Nhận xét & tiến bộ
              </NavLink>
            )}
            <p className={styles.groupLabel}>LỊCH HỌC</p>
            <NavLink
              to={
                selectedChild
                  ? `/family/children/${selectedChild}/schedule`
                  : "/family"
              }
            >
              <Icon name="calendar" />
              Lịch học
            </NavLink>
            {selectedChild && (
              <NavLink to={`/family/children/${selectedChild}/attendance`}>
                <Icon name="check" />
                Điểm danh của bé
              </NavLink>
            )}
            {selectedChild && (
              <>
                <p className={styles.groupLabel}>HỌC PHÍ</p>
                <NavLink to={`/family/children/${selectedChild}/invoices`}>
                  <Icon name="receipt" />
                  Phiếu học phí
                </NavLink>
                <NavLink to={`/family/children/${selectedChild}/tuition`}>
                  <Icon name="wallet" />
                  Điều kiện học phí
                </NavLink>
              </>
            )}
          </>
        )}
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.mascot}>
          <ReadingElephant />
          <p>Mỗi ngày một chút lớn khôn.</p>
        </div>
        <NavLink
          className={styles.settingsLink}
          to={`${root}/account`}
          onClick={() => setOpen(false)}
        >
          <Icon name={teacher ? "settings" : "user"} />
          {teacher ? "Cài đặt" : "Tài khoản"}
        </NavLink>
        <div className={styles.sidebarAccount}>
          <Avatar name={account!.displayName} />
          <div>
            <strong>{account!.displayName}</strong>
            <span>{teacher ? "Giáo viên" : "Phụ huynh"}</span>
          </div>
        </div>
      </div>
    </>
  );
  return (
    <div
      className={`${styles.shell} ${!teacher ? styles.family : ""} ${studying ? styles.studying : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      {desktop ? (
        <aside className={`sidebar ${styles.sidebar}`}>{navigation}</aside>
      ) : (
        <dialog
          ref={drawer}
          className={`sidebar ${styles.sidebar} ${styles.drawer}`}
          aria-label="Điều hướng chính"
          onKeyDown={trapDialogFocus}
          onCancel={(e) => {
            e.preventDefault();
            setOpen(false);
          }}
          onClick={(e) => {
            if (
              e.target === e.currentTarget &&
              e.clientX > e.currentTarget.getBoundingClientRect().right
            )
              setOpen(false);
          }}
        >
          {navigation}
        </dialog>
      )}
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              ref={menuButton}
              className={`icon-button ${styles.menuButton}`}
              aria-label="Mở menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" />
            </button>
            {studying ? (
              <Link className="text-link" to="/family">
                <Icon name="home" />
                Về góc gia đình
              </Link>
            ) : (
              <span className={styles.topbarTitle}>
                {teacher ? "Không gian giảng dạy" : "Đồng hành cùng con"}
              </span>
            )}
            {!teacher && children.data && children.data.length > 0 && (
              <label className={styles.childSelect}>
                <span>
                  {children.data.length > 1 ? "Đang xem bé" : "Bé của bạn"}
                </span>
                <select
                  aria-label="Chọn bé"
                  value={selectedChild || ""}
                  onChange={(e) => changeChild(e.target.value)}
                >
                  {children.data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className={styles.topbarRight}>
            {(teacher || verified) && (
              <NotificationBell key={accountId} root={root} />
            )}
            <span className={styles.date}>
              <Icon name="calendar" />
              {new Intl.DateTimeFormat("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                timeZone: "Asia/Ho_Chi_Minh",
              }).format(today)}
            </span>
            <details ref={accountMenu} className={styles.accountMenu}>
              <summary aria-label="Menu tài khoản">
                <Avatar name={account!.displayName} />
                <span className={styles.accountName}>
                  {account!.displayName}
                  <small>{teacher ? "Giáo viên" : "Phụ huynh"}</small>
                </span>
                <Icon name="chevron" />
              </summary>
              <div
                className={styles.accountPopover}
                onClick={() => {
                  if (accountMenu.current) accountMenu.current.open = false;
                }}
              >
                <p>{account!.email}</p>
                <Link to={`${root}/account`}>
                  <Icon name="user" />
                  Hồ sơ & đăng nhập
                </Link>
                {teacher && (
                  <Link to="/teacher/files">
                    <Icon name="upload" />
                    Học liệu & lưu trữ
                  </Link>
                )}
                <button disabled={busy} onClick={signOut}>
                  <Icon name="logout" />
                  Đăng xuất
                </button>
              </div>
            </details>
          </div>
        </header>
        <main className={styles.main} id="main-content" tabIndex={-1}>
          <ErrorNotice
            error={error || children.error}
            retry={children.error ? children.reload : undefined}
          />
          {!teacher &&
            routeChild &&
            child &&
            location.pathname !== `/family/children/${routeChild}` && (
            <p className={styles.childContext}>
              <Avatar name={child.fullName} />
              Hành trình của <strong>{child.fullName}</strong>
            </p>
          )}
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className={styles.footer}>
          <span>TinyClass</span>
          <span>Mỗi ngày một chút lớn khôn.</span>
        </footer>
      </div>
      {!teacher && (
        <nav className={styles.bottomNav} aria-label="Điều hướng gia đình">
          <NavLink to="/family" end>
            <Icon name="home" />
            <span>Trang chủ</span>
          </NavLink>
          <NavLink
            to={learningLink}
            className={location.pathname.includes("/learning") ? "active" : ""}
          >
            <Icon name="book" />
            <span>Bài của con</span>
          </NavLink>
          {selectedChild && (
            <NavLink to={`/family/children/${selectedChild}/schedule`}>
              <Icon name="calendar" />
              <span>Lịch học</span>
            </NavLink>
          )}
          {selectedChild && (
            <NavLink to={`/family/children/${selectedChild}/invoices`}>
              <Icon name="receipt" />
              <span>Học phí</span>
            </NavLink>
          )}
        </nav>
      )}
    </div>
  );
}
