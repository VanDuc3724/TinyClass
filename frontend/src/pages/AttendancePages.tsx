import { useCallback, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";
import { api } from "../lib/api";
import {
  attendanceChoices,
  attendanceLabels,
  attendancePeriod,
  attendanceStates,
} from "../lib/attendance";
import type {
  AttendanceRow,
  TeacherAttendance,
} from "../lib/attendance";
import type { Classroom, Student } from "../lib/types";
import { dateLabel, dateTimeLabel } from "../lib/format";
import { useResource } from "../lib/hooks";
import { AttendanceHistory } from "./AttendanceParts";
import styles from "./Attendance.module.css";

function pageNumber(params: URLSearchParams) {
  const value = Number(params.get("page") || 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function PeriodForm({
  from,
  to,
  active,
  valuesKey,
  children,
  onSubmit,
}: {
  from: string;
  to: string;
  active: boolean;
  valuesKey: string;
  children?: ReactNode;
  onSubmit: (data: FormData) => void;
}) {
  const [open, setOpen] = useState(false),
    id = useId(),
    toggle = useRef<HTMLButtonElement>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
    setOpen(false);
    if (toggle.current?.offsetParent !== null) toggle.current?.focus();
  }
  return (
    <form onSubmit={submit} className={`panel ${styles.filterPanel}`}>
      <div className={styles.filterHeading}>
        <button
          ref={toggle}
          type="button"
          className="button button-ghost"
          aria-label="Bộ lọc điểm danh"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name="filter" />
          Bộ lọc{active ? " · Đang lọc" : ""}
        </button>
        <p className="muted">{dateLabel(from)} – {dateLabel(to)}</p>
      </div>
      <div
        id={id}
        className={`${styles.filterContent} ${open ? styles.filterOpen : ""}`}
      >
        {/* Refresh uncontrolled fields after navigation while keeping the toggle and its focus. */}
        <div key={valuesKey} className={styles.filters}>
          <Field label="Từ ngày">
            <input
              type="date"
              name="from"
              defaultValue={from}
              required
              min="1900-01-01"
              max="2200-12-31"
            />
          </Field>
          <Field label="Đến ngày">
            <input
              type="date"
              name="to"
              defaultValue={to}
              required
              min="1900-01-01"
              max="2200-12-31"
            />
          </Field>
          {children}
          <button className="button button-primary">Xem kết quả</button>
        </div>
        <p className="muted">Chọn tối đa 93 ngày mỗi lần · Giờ Việt Nam.</p>
      </div>
    </form>
  );
}

export function TeacherAttendancePage() {
  const [params, setParams] = useSearchParams(),
    { from, to } = attendancePeriod(params);
  const classId = params.get("classId") || "",
    studentId = params.get("studentId") || "",
    status = params.get("status") || "",
    page = pageNumber(params);
  const query = new URLSearchParams({
    from,
    to,
    page: String(page),
    size: "20",
    ...(classId && { classId }),
    ...(studentId && { studentId }),
    ...(status && { status }),
  }).toString();
  const resource = useResource(
    useCallback(
      (signal) => api.list<TeacherAttendance>(`/attendance?${query}`, signal),
      [query],
    ),
  );
  const options = useResource(
    useCallback(async (signal) => {
      const [classes, students] = await Promise.all([
        attendanceChoices<Classroom>("/classes", signal),
        attendanceChoices<Student>("/students", signal),
      ]);
      return { classes, students };
    }, []),
  );
  const [history, setHistory] = useState<AttendanceRow | null>(null);
  return (
    <>
      <PageHeader
        eyebrow="ĐỒNG HÀNH MỖI BUỔI"
        title="Điểm danh"
        description="Tra cứu kết quả đã ghi nhận theo buổi, lớp hoặc từng bé."
        action={
          <Link className="button button-primary" to="/teacher/schedule">
            Mở lịch để điểm danh
          </Link>
        }
      />
      <ErrorNotice error={options.error} retry={options.reload} />
      <PeriodForm
        valuesKey={`${from}:${to}:${classId}:${studentId}:${status}`}
        from={from}
        to={to}
        active={!!(classId || studentId || status)}
        onSubmit={(form) => {
          const next = new URLSearchParams();
          for (const name of ["from", "to", "classId", "studentId", "status"]) {
            const value = String(form.get(name) || "");
            if (value) next.set(name, value);
          }
          setParams(next);
        }}
      >
        <Field label="Lớp học">
          <select
            key={options.data ? "loaded" : "pending"}
            name="classId"
            defaultValue={classId}
            disabled={!options.data}
          >
            <option value="">Tất cả lớp</option>
            {classId &&
              !options.data?.classes.some((item) => item.id === classId) && (
                <option value={classId}>Lớp đã chọn</option>
              )}
            {options.data?.classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Học sinh">
          <select
            key={options.data ? "loaded" : "pending"}
            name="studentId"
            defaultValue={studentId}
            disabled={!options.data}
          >
            <option value="">Tất cả bé</option>
            {studentId &&
              !options.data?.students.some((item) => item.id === studentId) && (
                <option value={studentId}>Bé đã chọn</option>
              )}
            {options.data?.students.map((item) => (
              <option key={item.id} value={item.id}>
                {item.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trạng thái">
          <select name="status" defaultValue={status}>
            <option value="">Tất cả trạng thái</option>
            {attendanceStates.map((value) => (
              <option value={value} key={value}>
                {attendanceLabels[value]}
              </option>
            ))}
          </select>
        </Field>
      </PeriodForm>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && !resource.data ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            {resource.data.data.length ? (
              <div className={styles.familyGrid}>
                {resource.data.data.map((row) => (
                  <article
                    className={styles.familyRow}
                    key={row.id}
                    aria-label={`Kết quả ${row.studentName} · ${row.sessionTitle}`}
                  >
                    <AttendanceResult row={row} />
                    <p>
                      <Link
                        className="text-link"
                        to={`/teacher/students/${row.studentId}`}
                      >
                        {row.studentName}
                      </Link>
                    </p>
                    {row.note && <p>Ghi chú riêng: {row.note}</p>}
                    {row.familyNote && <p>Gửi gia đình: {row.familyNote}</p>}
                    <div className={styles.rowActions}>
                      <Link
                        className="button button-ghost"
                        to={`/teacher/sessions/${row.sessionId}/attendance`}
                      >
                        Mở điểm danh buổi
                      </Link>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setHistory(row)}
                      >
                        Lịch sử điểm danh
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <section className="panel">
                <EmptyState
                  title="Chưa có kết quả trong khoảng đã chọn"
                  icon="check"
                >
                  Mở một buổi trong lịch dạy, chốt danh sách rồi điểm danh cho
                  các bé.
                </EmptyState>
              </section>
            )}
            <Pagination
              meta={resource.data.meta}
              onChange={(value) => {
                const next = new URLSearchParams(params);
                next.set("page", String(value));
                setParams(next);
              }}
            />
          </>
        )
      )}
      {history && (
        <AttendanceHistory
          key={history.id}
          id={history.id}
          name={history.studentName}
          onClose={() => setHistory(null)}
        />
      )}
    </>
  );
}

function AttendanceResult({ row }: { row: AttendanceRow }) {
  return (
    <>
      <div className={styles.rowMeta}>
        <Badge status={row.status} />
        <Badge status={row.sessionStatus} />
      </div>
      <h2>{row.sessionTitle}</h2>
      <p className="muted">{row.className}</p>
      <p>
        {dateTimeLabel(row.startsAt)} – {dateTimeLabel(row.endsAt)}
      </p>
      {!row.isActive && (
        <p className={styles.information}>
          Bé đã được loại khỏi danh sách buổi. Kết quả cũ chỉ để đối chiếu.
        </p>
      )}
      {row.sessionStatus === "CANCELLED" && (
        <p className={styles.warning}>
          Buổi đã hủy: {row.cancellationReason || "Cô đã hủy buổi này."} Không
          tính kết quả tham gia.
        </p>
      )}
      {row.status === "UNMARKED" &&
        row.isActive &&
        row.sessionStatus !== "CANCELLED" && (
          <p className="muted">Cô chưa ghi nhận trạng thái tham gia của bé.</p>
        )}
    </>
  );
}
