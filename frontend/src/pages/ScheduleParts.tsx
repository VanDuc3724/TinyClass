import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge, ErrorNotice, Field, Icon } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { businessToday, dateLabel, dateTimeLabel } from "../lib/format";
import { useUnsavedChanges } from "../lib/hooks";
import {
  addDays,
  businessLocal,
  localInstant,
  sessionHours,
} from "../lib/schedule";
import type {
  CalendarClass,
  SchedulePlan,
  TeachingSession,
} from "../lib/schedule";
import styles from "./Schedule.module.css";

export function SessionCard({
  session,
  teacher = false,
}: {
  session: TeachingSession;
  teacher?: boolean;
}) {
  const [asOf] = useState(() => Date.now());
  const cancelled = session.status === "CANCELLED";
  const body = (
    <>
      <span className={styles.timeIcon}>
        <Icon name="calendar" />
      </span>
      <div>
        <div className={styles.sessionTime}>{sessionHours(session)}</div>
        <h3>{session.title}</h3>
        {session.title !== session.className && (
          <p className="muted">{session.className}</p>
        )}
        <p className="muted">
          {session.location || "Cô sẽ thông báo địa điểm"}
        </p>
        <div className={styles.meta}>
          <Badge status={session.status} />
          {session.status === "SCHEDULED" &&
            new Date(session.endsAt).getTime() < asOf && (
              <small>Đã qua giờ theo lịch</small>
            )}
          {teacher && session.isManualOverride && !cancelled && (
            <small>
              {session.scheduleRuleId ? "Đã chỉnh riêng" : "Buổi riêng"}
            </small>
          )}
        </div>
        {cancelled && <p>Lý do hủy: {session.cancellationReason}</p>}
      </div>
      {teacher && <Icon name="arrow" />}
    </>
  );
  return teacher ? (
    <Link
      className={`${styles.sessionCard} ${cancelled ? styles.cancelled : ""}`}
      to={`/teacher/schedule/sessions/${session.id}`}
    >
      {body}
    </Link>
  ) : (
    <article
      className={`${styles.sessionCard} ${cancelled ? styles.cancelled : ""}`}
    >
      {body}
    </article>
  );
}

export function PlanPreview({
  plan,
  confirmed,
  onConfirm,
}: {
  plan: SchedulePlan;
  confirmed: boolean;
  onConfirm: (value: boolean) => void;
}) {
  return (
    <section className={styles.preview} aria-label="Xem trước thay đổi lịch">
      <h3>Xem trước thay đổi</h3>
      <p>
        <strong>{plan.created}</strong> buổi tạo mới ·{" "}
        <strong>{plan.updated}</strong> buổi đổi ·{" "}
        <strong>{plan.cancelled}</strong> buổi hủy ·{" "}
        <strong>{plan.skipped}</strong> vị trí giữ nguyên/bỏ qua
      </p>
      {plan.candidates.length > 0 && (
        <ul>
          {plan.candidates.slice(0, 8).map((candidate, index) => (
            <li key={index}>
              {candidate.action === "CREATE"
                ? "Tạo"
                : candidate.action === "UPDATE"
                  ? "Đổi"
                  : "Hủy"}
              : {dateTimeLabel(candidate.startsAt)} · {candidate.title}
            </li>
          ))}
        </ul>
      )}
      {plan.candidates.length > 8 && (
        <p className="muted">Và các buổi còn lại trong phạm vi đã chọn.</p>
      )}
      {plan.conflictCount > 0 && (
        <div className={styles.conflicts}>
          <h4>Có {plan.conflictCount} cặp buổi trùng giờ</h4>
          <ul>
            {plan.conflicts.slice(0, 8).map((conflict, index) => (
              <li key={index}>
                {dateTimeLabel(conflict.candidateStartsAt)} ·{" "}
                {conflict.candidateTitle} trùng với {conflict.otherTitle} (
                {conflict.otherClassName},{" "}
                {dateTimeLabel(conflict.otherStartsAt)}).
              </li>
            ))}
          </ul>
          {plan.conflictCount > 8 && (
            <p>Chỉ liệt kê 8 cặp đầu; nên thu hẹp khoảng ngày để xem kỹ.</p>
          )}
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => onConfirm(event.target.checked)}
            />
            <span>Tôi đã xem các buổi trùng giờ và xác nhận lưu ngoại lệ.</span>
          </label>
        </div>
      )}
      <p className={styles.hint}>
        Chỉ ghi lịch khi cô xác nhận. Hệ thống sẽ kiểm tra lại trước khi lưu.
      </p>
    </section>
  );
}

export function SessionForm({
  classes,
  session,
  initialClass,
  initialDate,
  onSaved,
  onClose,
  onBusyChange,
  onDirtyChange,
}: {
  classes: CalendarClass[];
  session?: TeachingSession;
  initialClass?: string;
  initialDate?: string;
  onSaved: (value: TeachingSession) => void;
  onClose: () => void;
  onBusyChange?: (value: boolean) => void;
  onDirtyChange?: (value: boolean) => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [plan, setPlan] = useState<SchedulePlan | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [dirty, setDirty] = useState(false);
  const canLeave = useUnsavedChanges(dirty);
  const tomorrow = addDays(businessToday(), 1),
    day = initialDate && initialDate > businessToday() ? initialDate : tomorrow;
  const selected =
    session?.classId ||
    (initialClass
      ? classes.find((c) => c.id === initialClass && c.status === "ACTIVE")
          ?.id || ""
      : classes.find((c) => c.status === "ACTIVE")?.id || "");
  const validClasses = classes.filter(
    (c) => c.status === "ACTIVE" || c.id === session?.classId,
  );
  const current = classes.find((c) => c.id === selected);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      classId: String(form.get("classId")),
      clientRequestId: requestId,
      version: session?.version,
      startsAt: localInstant(String(form.get("startsAt"))),
      endsAt: localInstant(String(form.get("endsAt"))),
      title: String(form.get("title")),
      location: String(form.get("location")),
      lessonPlan: String(form.get("lessonPlan")),
      reason: String(form.get("reason") || ""),
      preview: !plan,
      allowConflicts: confirmed,
      conflictKey: plan?.conflictKey,
    };
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const result = session
        ? await api.patch<SchedulePlan>(`/sessions/${session.id}`, payload)
        : await api.post<SchedulePlan>("/sessions", payload);
      if (plan && result.session) {
        setDirty(false);
        onDirtyChange?.(false);
        onSaved(result.session);
      } else {
        setPlan(result);
        setConfirmed(false);
      }
    } catch (failure) {
      setError(failure);
      if (failure instanceof ApiError && failure.status === 409) {
        setPlan(null);
        setConfirmed(false);
      }
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <ErrorNotice error={error} />
      <fieldset
        disabled={busy}
        onChange={() => {
          setDirty(true);
          onDirtyChange?.(true);
          setPlan(null);
          setConfirmed(false);
        }}
      >
        <Field label="Lớp học">
          <select
            name="classId"
            defaultValue={selected}
            required
            disabled={!!session || busy}
          >
            {!selected && <option value="">Chọn lớp đang dạy</option>}
            {validClasses.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {session && (
          <input type="hidden" name="classId" value={session.classId} />
        )}
        <Field label="Tên buổi học">
          <input
            name="title"
            maxLength={200}
            defaultValue={session?.title || ""}
            placeholder="Ví dụ: Khám phá màu sắc"
          />
        </Field>
        <div className={styles.formGrid}>
          <Field label="Bắt đầu">
            <input
              type="datetime-local"
              name="startsAt"
              required
              step="60"
              min={`${businessToday()}T00:00`}
              max={`${addDays(businessToday(), 366)}T23:59`}
              defaultValue={
                session ? businessLocal(session.startsAt) : `${day}T09:00`
              }
            />
          </Field>
          <Field label="Kết thúc">
            <input
              type="datetime-local"
              name="endsAt"
              required
              step="60"
              defaultValue={
                session ? businessLocal(session.endsAt) : `${day}T10:00`
              }
            />
          </Field>
        </div>
        <p className={styles.hint}>
          Giờ Việt Nam (UTC+7). Một buổi tối đa 12 giờ.
        </p>
        <Field label="Địa điểm" optional>
          <input
            name="location"
            maxLength={300}
            defaultValue={session?.location ?? current?.location ?? ""}
          />
        </Field>
        <Field label="Kế hoạch riêng của cô" optional>
          <textarea
            name="lessonPlan"
            rows={4}
            maxLength={5000}
            defaultValue={session?.lessonPlan || ""}
          />
          <small>
            Chỉ cô xem phần này. Tên buổi và địa điểm được chia sẻ với gia đình.
          </small>
        </Field>
        {session && (
          <Field label="Lý do đổi buổi">
            <textarea name="reason" rows={2} maxLength={1000} required />
          </Field>
        )}
      </fieldset>
      {plan && (
        <PlanPreview
          plan={plan}
          confirmed={confirmed}
          onConfirm={setConfirmed}
        />
      )}
      <div className="form-actions">
        <button
          type="button"
          className="button button-ghost"
          disabled={busy}
          onClick={() => {
            if (canLeave()) onClose();
          }}
        >
          Quay lại
        </button>
        <button
          className="button button-primary"
          disabled={
            busy ||
            !validClasses.length ||
            !!(plan?.conflictCount && !confirmed)
          }
        >
          {busy
            ? "Đang kiểm tra…"
            : plan
              ? session
                ? "Xác nhận đổi buổi"
                : "Xác nhận tạo buổi"
              : "Xem trước buổi học"}
        </button>
      </div>
      {!validClasses.length && (
        <p className={styles.hint}>
          Cô cần mở một lớp trước khi thêm buổi học.
        </p>
      )}
    </form>
  );
}

export function WeekBar({
  start,
  onChange,
}: {
  start: string;
  onChange: (day: string) => void;
}) {
  return (
    <>
      <div className={styles.weekBar}>
        <div>
          <h2>
            {dateLabel(start)} – {dateLabel(addDays(start, 6))}
          </h2>
          <p className={styles.zone}>Giờ Việt Nam · UTC+7</p>
        </div>
        <div className={styles.weekControls}>
          <button
            className="button button-ghost"
            aria-label="Tuần trước"
            onClick={() => onChange(addDays(start, -7))}
          >
            ←
          </button>
          <button
            className="button button-ghost"
            onClick={() => onChange(businessToday())}
          >
            Tuần này
          </button>
          <button
            className="button button-ghost"
            aria-label="Tuần sau"
            onClick={() => onChange(addDays(start, 7))}
          >
            →
          </button>
          <input
            type="date"
            aria-label="Tuần có ngày"
            value={start}
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value);
            }}
          />
        </div>
      </div>
      <ol className={styles.days} aria-label="Bảy ngày trong tuần">
        {Array.from({ length: 7 }, (_, index) => {
          const day = addDays(start, index);
          return (
            <li
              key={day}
              className={day === businessToday() ? styles.today : undefined}
            >
              <span>{index === 6 ? "CN" : `Thứ ${index + 2}`}</span>
              <strong>
                <time dateTime={day}>{day.slice(8)}</time>
              </strong>
            </li>
          );
        })}
      </ol>
    </>
  );
}
