import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactNode, SVGProps } from "react";
import { ApiError } from "../lib/api";
import {
  classStatusLabels,
  submissionStatusLabels,
  statusLabels,
  statusTone,
} from "../constants/status";
import styles from "./ui.module.css";
import { trapDialogFocus } from "../lib/accessibility";

type IconName =
  | "home"
  | "bell"
  | "classes"
  | "students"
  | "plus"
  | "arrow"
  | "search"
  | "close"
  | "menu"
  | "logout"
  | "edit"
  | "clock"
  | "check"
  | "leaf"
  | "book"
  | "lock"
  | "eye"
  | "pin"
  | "calendar"
  | "settings"
  | "user"
  | "chevron"
  | "upload"
  | "megaphone"
  | "receipt"
  | "wallet"
  | "message";
const paths: Record<IconName, ReactNode> = {
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5" />
    </>
  ),
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M9 21v-8h6v8" />
    </>
  ),
  classes: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8m-4-4v4M7 8h10M7 12h6" />
    </>
  ),
  students: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M2 21v-3a7 7 0 0 1 14 0v3m2-17a3 3 0 0 1 0 6m2 11v-3a7 7 0 0 0-2-5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  logout: (
    <>
      <path d="M9 4H4v16h5m6-12 4 4-4 4M9 12h10" />
    </>
  ),
  edit: (
    <>
      <path d="m15 5 4 4M4 20l5-1L21 7a2.8 2.8 0 0 0-4-4L5 15ZM13 20h8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  leaf: (
    <>
      <path d="M20 3C9 2 2 8 5 15s15 4 15-12Z" />
      <path d="m4 21 11-11" />
    </>
  ),
  book: (
    <>
      <path d="M12 5C8 2 3 3 2 4v15c3-2 7-2 10 0 3-2 7-2 10 0V4c-3-2-7-2-10 1Zm0 0v14" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  pin: (
    <>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4h3l8 4V6l-8 4Z" />
      <path d="M19 9a4 4 0 0 1 0 6M7 14l1 6h3l-1-5" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M16 15h2" />
    </>
  ),
  message: (
    <>
      <path d="M4 5h16v11H9l-5 4Z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
};
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <Icon name="book" />
      </span>
      <span>
        TinyClass<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export function Avatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  const initials = (name.replace(/\([^)]*\)/g, "").trim() || name)
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] || "")
    .join("")
    .toLocaleUpperCase("vi-VN");
  return (
    <span
      className={`avatar ${styles.avatar} ${large ? styles.large : ""}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
export function Badge({
  status,
  context,
}: {
  status: string;
  context?: "class" | "submission";
}) {
  return (
    <span
      className={`badge ${styles.badge} ${styles[statusTone(status)] || ""}`}
    >
      <span />
      {(context === "class"
        ? classStatusLabels[status]
        : context === "submission"
          ? submissionStatusLabels[status]
          : statusLabels[status]) ||
        statusLabels[status] ||
        status}
    </span>
  );
}
export function Loading({ text = "Đang tải dữ liệu…" }: { text?: string }) {
  return (
    <div className={styles.loading} role="status" aria-busy="true">
      <span className={styles.skeleton} aria-hidden="true" />
      <span className={styles.skeleton} aria-hidden="true" />
      <span className={styles.skeleton} aria-hidden="true" />
      <span className={styles.loadingText}>{text}</span>
    </div>
  );
}
const fieldLabels: Record<string, string> = {
  name: "Tên lớp",
  fullName: "Họ và tên bé",
  email: "Email",
  password: "Mật khẩu",
  displayName: "Tên giáo viên",
  setupKey: "Mã khởi tạo",
  capacity: "Sĩ số",
  birthDate: "Ngày sinh",
  minAgeMonths: "Tuổi tối thiểu",
  maxAgeMonths: "Tuổi tối đa",
};
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const notice = useRef<HTMLDivElement>(null),
    errorId = useId();
  useEffect(() => {
    if (!(error instanceof ApiError) || !error.fieldErrors.length) return;
    const form =
      notice.current?.closest("form") ||
      notice.current?.parentElement?.querySelector("form");
    const controls = [
      ...(form?.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input,select,textarea") || []),
    ];
    const changed: {
      control: HTMLElement;
      described: string | null;
      invalid: string | null;
    }[] = [];
    error.fieldErrors.forEach((field, index) => {
      const control = controls.find((item) => item.name === field.field);
      if (!control) return;
      changed.push({
        control,
        described: control.getAttribute("aria-describedby"),
        invalid: control.getAttribute("aria-invalid"),
      });
      control.setAttribute("aria-invalid", "true");
      control.setAttribute(
        "aria-describedby",
        `${control.getAttribute("aria-describedby") || ""} ${errorId}-${index}`.trim(),
      );
    });
    changed[0]?.control.focus();
    return () =>
      changed.forEach(({ control, described, invalid }) => {
        if (described) control.setAttribute("aria-describedby", described);
        else control.removeAttribute("aria-describedby");
        if (invalid) control.setAttribute("aria-invalid", invalid);
        else control.removeAttribute("aria-invalid");
      });
  }, [error, errorId]);
  if (!error) return null;
  return (
    <div ref={notice} className="error-notice" role="alert">
      <p>
        {error instanceof Error
          ? error.message
          : "Có lỗi xảy ra. Vui lòng thử lại."}
      </p>
      {error instanceof ApiError && error.fieldErrors.length > 0 && (
        <ul>
          {error.fieldErrors.map((field, index) => (
            <li id={`${errorId}-${index}`} key={`${field.field}-${index}`}>
              {fieldLabels[field.field] || "Thông tin nhập"}: {field.message}
            </li>
          ))}
        </ul>
      )}
      {retry && (
        <button type="button" className="text-button" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  );
}
export function EmptyState({
  title,
  children,
  action,
  icon = "classes",
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Icon name={icon} width="30" height="30" />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`page-heading ${styles.pageHeader}`}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Pagination({
  meta,
  onChange,
}: {
  meta: { page: number; totalPages: number; totalElements: number };
  onChange: (page: number) => void;
}) {
  if (meta.totalElements === 0) return null;
  return (
    <div className="pagination">
      <span>
        {meta.totalElements} kết quả · Trang {meta.page + 1}/
        {Math.max(1, meta.totalPages)}
      </span>
      <div>
        <button
          type="button"
          className="button button-small button-ghost"
          disabled={meta.page === 0}
          onClick={() => onChange(meta.page - 1)}
        >
          Trước
        </button>
        <button
          type="button"
          className="button button-small button-ghost"
          disabled={meta.page + 1 >= meta.totalPages}
          onClick={() => onChange(meta.page + 1)}
        >
          Sau
        </button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      onKeyDown={trapDialogFocus}
      aria-labelledby={titleId}
      className={`modal ${styles.modal} ${wide ? styles.wide : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Đóng"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
  optional = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  optional?: boolean;
}) {
  const hintId = useId();
  function describe(node: ReactNode): ReactNode {
    if (
      !isValidElement<{ children?: ReactNode; "aria-describedby"?: string }>(
        node,
      )
    )
      return node;
    if (
      typeof node.type === "string" &&
      ["input", "select", "textarea"].includes(node.type)
    )
      return cloneElement(node, {
        "aria-describedby": [node.props["aria-describedby"], hintId]
          .filter(Boolean)
          .join(" "),
      });
    if (node.props.children)
      return cloneElement(node, {
        children: Children.map(node.props.children, describe),
      });
    return node;
  }
  return (
    <label className="field">
      <span>
        {label}
        {optional && <small>Không bắt buộc</small>}
      </span>
      {hint ? Children.map(children, describe) : children}
      {hint && (
        <small id={hintId} className="muted">
          {hint}
        </small>
      )}
    </label>
  );
}
export function ImagePreview({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src)
    return (
      <span
        className={`image-fallback ${className}`}
        role="img"
        aria-label={alt ? `Không tải được ảnh: ${alt}` : "Không tải được ảnh"}
      >
        <Icon name="book" width="32" height="32" />
        <span>Không tải được ảnh</span>
      </span>
    );
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(src)}
    />
  );
}
export function ReadingElephant({ className }: { className?: string } = {}) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 140"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="80" cy="127" rx="60" ry="7" fill="var(--tc-primary-soft)" />
      <ellipse cx="80" cy="89" rx="40" ry="37" fill="var(--tc-primary-soft)" />
      <ellipse cx="41" cy="60" rx="25" ry="29" fill="var(--tc-info-soft)" />
      <ellipse cx="119" cy="60" rx="25" ry="29" fill="var(--tc-info-soft)" />
      <ellipse cx="41" cy="60" rx="16" ry="20" fill="var(--tc-accent-soft)" />
      <ellipse cx="119" cy="60" rx="16" ry="20" fill="var(--tc-accent-soft)" />
      <rect
        x="46"
        y="23"
        width="68"
        height="75"
        rx="33"
        fill="var(--tc-primary-soft)"
      />
      <path
        d="M78 68v30c0 14 20 14 20 0"
        stroke="var(--tc-primary-soft)"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <path
        d="M62 59q4-5 8 0m22 0q4-5 8 0"
        stroke="var(--tc-primary)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="60" cy="70" r="5" fill="var(--tc-accent-soft)" />
      <circle cx="103" cy="70" r="5" fill="var(--tc-accent-soft)" />
      <path
        d="M37 90q23-8 43 3 20-11 43-3v35q-23-8-43 2-20-10-43-2Z"
        fill="var(--tc-warning-soft)"
        stroke="var(--tc-primary)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M80 93v34M48 103l21 4m-21 6 21 4m22-10 20-4m-20 14 20-4"
        stroke="var(--tc-primary)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m25 19 2-7 3 7 7 2-7 3-3 7-2-7-7-3Z"
        fill="var(--tc-warning-soft)"
      />
      <circle cx="133" cy="23" r="4" fill="var(--tc-accent-soft)" />
    </svg>
  );
}
