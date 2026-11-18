import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  matchPath,
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
  Field,
  Icon,
  Loading,
  Modal,
  ReadingElephant,
} from "../components/ui";
import { api } from "../lib/api";
import { businessToday, dateLabel } from "../lib/format";
import { useResource } from "../lib/hooks";
import { trapDialogFocus } from "../lib/accessibility";
import {
  childProfilePath,
  ParentAccessContext,
  readChildModeProfile,
  saveChildModeProfile,
  useChildMode,
} from "../lib/childMode";
import styles from "./AppLayout.module.css";
import NotificationBell from "../components/NotificationBell";
import PageErrorBoundary from "../components/PageErrorBoundary";

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
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search + location.hash }}
        replace
      />
    );
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
function SectionLink({
  to,
  paths = [to],
  end = false,
  children,
}: {
  to: string;
  paths?: string[];
  end?: boolean;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const active = paths.some((path) => matchPath({ path, end }, pathname));
  return (
    <Link
      to={to}
      className={active ? "active" : undefined}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
// A sibling of Outlet inside Suspense runs only once the new lazy screen commits.
function RouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      // Let drawer cleanup restore focus first; an open modal owns focus and scrolling.
      if (document.querySelector('dialog[open], [aria-modal="true"]')) return;
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.getElementById("main-content")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  return null;
}
export default function AppLayout() {
  const { account } = useAuth();
  return account?.role === "PARENT" ? (
    <FamilyLayout key={account.id} accountId={account.id} />
  ) : (
    <WorkspaceLayout />
  );
}

function FamilyLayout({ accountId }: { accountId: string }) {
  const { pathname } = useLocation();
  const childMode = useChildMode();
  const profile = childMode ? childProfilePath(pathname) : null;
  const [childProfile, setChildProfile] = useState(() =>
    readChildModeProfile(accountId),
  );
  const leaving = useRef(false);
  useLayoutEffect(() => {
    if (!profile) leaving.current = false;
    if (!profile || childProfile || leaving.current) return;
    saveChildModeProfile(accountId, profile);
    setChildProfile(profile);
  }, [accountId, childProfile, profile]);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setChildProfile(readChildModeProfile(accountId));
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, [accountId]);

  if (childProfile && profile !== childProfile) {
    return <Navigate replace to={`${childProfile}/kids`} />;
  }
  if (profile) {
    return (
      <ChildLayout
        profile={profile}
        onExit={() => {
          leaving.current = true;
          saveChildModeProfile(accountId, null);
          setChildProfile(null);
        }}
      />
    );
  }
  return <WorkspaceLayout />;
}

function parentChallenge(previousResult?: number) {
  const first = 7 + Math.floor(Math.random() * 3);
  const choices = [4, 5, 6, 7, 8].filter((second) => first + second !== previousResult);
  return [first, choices[Math.floor(Math.random() * choices.length)]] as const;
}

function ParentConfirmation({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [challenge, setChallenge] = useState(() => parentChallenge());
  const [first, second] = challenge;
  const [retry, setRetry] = useState(false);
  const answerField = useRef<HTMLInputElement>(null);
  const retryId = useId();
  useLayoutEffect(() => {
    if (retry) answerField.current?.focus();
  }, [challenge, retry]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answer = String(
      new FormData(event.currentTarget).get("answer"),
    ).trim();
    if (!/^\d{1,2}$/.test(answer) || Number(answer) !== first + second) {
      event.currentTarget.reset();
      setChallenge(parentChallenge(first + second));
      setRetry(true);
      return;
    }
    onConfirm();
  }

  return (
    <Modal title="Nhờ người lớn xác nhận" onClose={onClose}>
      <p className="muted">Phụ huynh giải phép tính để tiếp tục.</p>
      <form onSubmit={submit}>
        <Field label={`Kết quả của ${first} + ${second}`}>
          <input
            ref={answerField}
            name="answer"
            inputMode="numeric"
            required
            maxLength={2}
            autoComplete="off"
            aria-describedby={retry ? retryId : undefined}
            onChange={() => setRetry(false)}
          />
        </Field>
        {retry && (
          <p id={retryId} role="alert" className={styles.childExitError}>
            Kết quả chưa đúng. Vui lòng giải phép tính mới.
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={onClose}
          >
            Ở lại góc của bé
          </button>
          <button className="button button-primary">Xác nhận</button>
        </div>
      </form>
    </Modal>
  );
}

function ChildLayout({
  profile,
  onExit,
}: {
  profile: string;
  onExit: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [parentDestination, setParentDestination] = useState<string | null>(null);
  const corner = `${profile}/kids`;
  const atCorner = location.pathname.replace(/\/$/, "") === corner;
  return (
    <ParentAccessContext.Provider value={setParentDestination}>
      <div className={styles.childShell}>
        <a className="skip-link" href="#main-content">
          Đến nội dung chính
        </a>
        <header className={styles.childTopbar}>
          {atCorner ? (
            <Brand />
          ) : (
            <Link className={styles.childHome} to={corner}>
              <Icon name="home" />
              Về góc của bé
            </Link>
          )}
          {atCorner && (
            <button
              type="button"
              className={styles.childExit}
              onClick={() => setParentDestination(profile)}
            >
              Về trang phụ huynh
            </button>
          )}
        </header>
        <main className={styles.childMain} id="main-content" tabIndex={-1}>
          <PageErrorBoundary resetKey={location.key}>
            <Suspense fallback={<Loading text="Đang mở…" />}>
              <RouteFocus />
              <Outlet />
            </Suspense>
          </PageErrorBoundary>
        </main>
        {parentDestination && (
          <ParentConfirmation
            onClose={() => setParentDestination(null)}
            onConfirm={() => {
              setParentDestination(null);
              onExit();
              navigate(parentDestination, { replace: true });
            }}
          />
        )}
      </div>
    </ParentAccessContext.Provider>
  );
}

function WorkspaceLayout() {
  const { account, logout } = useAuth();
  const location = useLocation(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [today, setToday] = useState(businessToday);
  const [desktop, setDesktop] = useState(
    () => window.matchMedia("(min-width: 1200px)").matches,
  );
  const drawer = useRef<HTMLDialogElement>(null),
    menuButton = useRef<HTMLButtonElement>(null);
  const accountMenu = useRef<HTMLDetailsElement>(null);
  const teacher = account!.role === "TEACHER",
    root = teacher ? "/teacher" : "/family";
  const accountRole = teacher ? "Giáo viên" : "Phụ huynh";
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
    let midnightTimer: number;
    const update = () => {
      window.clearTimeout(midnightTimer);
      const date = businessToday();
      setToday(date);
      const nextMidnight = Date.parse(`${date}T00:00:00+07:00`) + 86_400_000;
      midnightTimer = window.setTimeout(update, Math.max(1, nextMidnight - Date.now()));
    };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(midnightTimer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
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
        "/games",
        "/schedule",
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
        <SectionLink to={root} paths={teacher ? [root] : [root, "/family/children/:child"]} end>
          <Icon name="home" />
          {teacher ? "Tổng quan" : "Trang chủ"}
        </SectionLink>
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
            <SectionLink
              to="/teacher/attendance"
              paths={["/teacher/attendance", "/teacher/sessions/:session/attendance"]}
            >
              <Icon name="check" />
              Điểm danh
            </SectionLink>
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
            <SectionLink
              to="/teacher/games"
              paths={["/teacher/games", "/teacher/game-assignments"]}
            >
              <Icon name="game" />
              Kho trò chơi
            </SectionLink>
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
            <SectionLink
              to={
                selectedChild
                  ? `/family/children/${selectedChild}/announcements`
                  : "/family"
              }
              paths={
                selectedChild
                  ? [`/family/children/${selectedChild}/announcements`]
                  : []
              }
            >
              <Icon name="megaphone" />
              Thông báo lớp
            </SectionLink>
            <p className={styles.groupLabel}>HỌC TẬP</p>
            <SectionLink
              to={learningLink}
              paths={selectedChild ? [learningLink] : []}
            >
              <Icon name="book" />
              Bài của con
            </SectionLink>
            {selectedChild && (
              <NavLink to={`/family/children/${selectedChild}/games`}>
                <Icon name="game" />
                Góc chơi của bé
              </NavLink>
            )}
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
            <SectionLink
              to={
                selectedChild
                  ? `/family/children/${selectedChild}/schedule`
                  : "/family"
              }
              paths={
                selectedChild
                  ? [`/family/children/${selectedChild}/schedule`]
                  : []
              }
            >
              <Icon name="calendar" />
              Lịch học
            </SectionLink>
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
          id="workspace-navigation"
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
              aria-controls={!desktop ? "workspace-navigation" : undefined}
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
              !teacher && <span className={styles.topbarTitle}>Đồng hành cùng con</span>
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
            <time className={styles.date} dateTime={today}>
              <Icon name="calendar" />
              {dateLabel(today)}
            </time>
            <details ref={accountMenu} className={styles.accountMenu}>
              <summary
                aria-label={`${account!.displayName} ${accountRole}, menu tài khoản`}
              >
                <Avatar name={account!.displayName} />
                <span className={styles.accountName}>
                  {account!.displayName}
                  <small>{accountRole}</small>
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
          <PageErrorBoundary resetKey={location.key}>
            <Suspense fallback={<Loading />}>
              <RouteFocus />
              <Outlet />
            </Suspense>
          </PageErrorBoundary>
        </main>
        <footer className={styles.footer}>
          <span>TinyClass</span>
          <span>Mỗi ngày một chút lớn khôn.</span>
        </footer>
      </div>
      {!teacher && (
        <nav className={styles.bottomNav} aria-label="Điều hướng gia đình">
          <SectionLink to="/family" paths={["/family", "/family/children/:child"]} end>
            <Icon name="home" />
            <span>Trang chủ</span>
          </SectionLink>
          <SectionLink
            to={learningLink}
            paths={selectedChild ? [learningLink] : []}
          >
            <Icon name="book" />
            <span>Bài của con</span>
          </SectionLink>
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
