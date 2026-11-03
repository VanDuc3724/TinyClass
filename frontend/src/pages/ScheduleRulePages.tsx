import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  Loading,
  Modal,
  PageHeader,
} from "../components/ui";
import { api, ApiError } from "../lib/api";
import { businessToday, dateLabel } from "../lib/format";
import { useResource, useUnsavedChanges } from "../lib/hooks";
import { addDays, weekdays } from "../lib/schedule";
import type { SchedulePlan, ScheduleRule } from "../lib/schedule";
import type { Classroom } from "../lib/types";
import { PlanPreview } from "./ScheduleParts";
import styles from "./Schedule.module.css";

export function ScheduleRulesPage() {
  const { id } = useParams();
  const [editing, setEditing] = useState<ScheduleRule | "new" | null>(null),
    [generating, setGenerating] = useState(false),
    [notice, setNotice] = useState("");
  const data = useResource(
    useCallback(
      async (signal) => {
        const [classroom, rules] = await Promise.all([
          api.get<Classroom>(`/classes/${id}`, signal),
          api.get<ScheduleRule[]>(`/classes/${id}/schedule-rules`, signal),
        ]);
        return { classroom, rules };
      },
      [id],
    ),
  );
  if (!data.data)
    return (
      <>
        <Link className="back-link" to="/teacher/schedule">
          ← Về lịch dạy
        </Link>
        {data.loading ? (
          <Loading />
        ) : (
          <ErrorNotice error={data.error} retry={data.reload} />
        )}
      </>
    );
  const { classroom, rules } = data.data,
    planning = ["DRAFT", "ACTIVE"].includes(classroom.status);
  return (
    <>
      <Link className="back-link" to={`/teacher/classes/${id}`}>
        ← Về lớp {classroom.name}
      </Link>
      <PageHeader
        eyebrow="NHỊP HỌC MỖI TUẦN"
        title={`Lịch tuần · ${classroom.name}`}
        description="Đặt giờ lặp theo từng thứ, rồi xem trước và sinh các buổi cụ thể."
        action={
          planning ? (
            <button
              className="button button-primary"
              onClick={() => setEditing("new")}
            >
              <Icon name="plus" />
              Thêm lịch tuần
            </button>
          ) : undefined
        }
      />
      <ErrorNotice error={data.error} retry={data.reload} />
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <div className={styles.actions}>
        <button
          className="button button-primary"
          disabled={
            classroom.status !== "ACTIVE" ||
            !rules.some((rule) => rule.isActive)
          }
          onClick={() => setGenerating(true)}
        >
          <Icon name="calendar" />
          Sinh buổi học
        </button>
        <Link
          className="button button-ghost"
          to={`/teacher/schedule?classId=${id}`}
        >
          Xem lịch của lớp
        </Link>
      </div>
      <p className={styles.hint}>
        Giờ Việt Nam · Mỗi quy tắc tương ứng một thứ trong tuần. Sinh lại giữ
        nguyên các buổi đã có, kể cả buổi đổi riêng hoặc đã hủy.
      </p>
      {classroom.status === "DRAFT" && (
        <p className={styles.hint}>
          Cô có thể chuẩn bị lịch tuần; mở lớp trước khi sinh buổi học.
        </p>
      )}
      <section className="panel">
        {rules.length ? (
          rules.map((rule) => (
            <article className={styles.rule} key={rule.id}>
              <div className={styles.ruleDay}>
                <small>HẰNG TUẦN</small>
                {weekdays[rule.weekday - 1]}
              </div>
              <div className={styles.ruleBody}>
                <h2>
                  {rule.startTime} – {rule.endTime}
                </h2>
                <p>
                  Từ {dateLabel(rule.effectiveFrom)}
                  {rule.effectiveTo
                    ? ` đến ${dateLabel(rule.effectiveTo)}`
                    : " · Chưa đặt ngày kết thúc"}
                </p>
                <p>{rule.location || "Chưa đặt địa điểm"}</p>
                <Badge status={rule.isActive ? "ACTIVE" : "PAUSED"} />
              </div>
              {planning && (
                <button
                  className="button button-ghost"
                  aria-label={`Sửa lịch ${weekdays[rule.weekday - 1]} ${rule.startTime}`}
                  onClick={() => setEditing(rule)}
                >
                  Chỉnh lịch
                </button>
              )}
            </article>
          ))
        ) : (
          <EmptyState title="Bắt đầu từ một giờ học quen thuộc" icon="calendar">
            Thêm thứ và giờ học của lớp. Cô sẽ chọn khoảng ngày và kiểm tra các
            buổi trước khi tạo.
          </EmptyState>
        )}
      </section>
      {editing && (
        <RuleEditor
          key={editing === "new" ? "new" : editing.id}
          classroom={classroom}
          rule={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice(
              editing === "new"
                ? "Đã lưu lịch tuần. Cô có thể xem trước và sinh buổi học."
                : "Đã áp dụng lịch tuần mới, giữ các buổi ngoài phạm vi và ngoại lệ.",
            );
            data.reload();
          }}
        />
      )}
      {generating && (
        <GenerateEditor
          classroom={classroom}
          onClose={() => setGenerating(false)}
          onSaved={(plan) => {
            setGenerating(false);
            setNotice(
              `Đã tạo ${plan.created} buổi; giữ nguyên/bỏ qua ${plan.skipped} vị trí đã có hoặc ngoài thời gian hợp lệ.`,
            );
            data.reload();
          }}
        />
      )}
    </>
  );
}

function RuleEditor({
  classroom,
  rule,
  onClose,
  onSaved,
}: {
  classroom: Classroom;
  rule?: ScheduleRule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [plan, setPlan] = useState<SchedulePlan | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [dirty, setDirty] = useState(false);
  const canLeave = useUnsavedChanges(dirty),
    close = () => {
      if (canLeave()) onClose();
    };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      version: rule?.version,
      weekday: Number(form.get("weekday")),
      startTime: String(form.get("startTime")),
      endTime: String(form.get("endTime")),
      timezone: "Asia/Ho_Chi_Minh",
      effectiveFrom: String(form.get("effectiveFrom")),
      effectiveTo: String(form.get("effectiveTo")) || null,
      location: String(form.get("location")),
      isActive: form.has("isActive"),
      preview: !!rule && !plan,
      allowConflicts: confirmed,
      conflictKey: plan?.conflictKey,
    };
    setBusy(true);
    setError(null);
    try {
      if (rule) {
        const result = await api.patch<SchedulePlan>(
          `/schedule-rules/${rule.id}`,
          body,
        );
        if (!plan) {
          setPlan(result);
          setConfirmed(false);
        } else {
          setDirty(false);
          onSaved();
        }
      } else {
        await api.post(`/classes/${classroom.id}/schedule-rules`, body);
        setDirty(false);
        onSaved();
      }
    } catch (failure) {
      setError(failure);
      if (failure instanceof ApiError && failure.status === 409) {
        setPlan(null);
        setConfirmed(false);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={rule ? "Điều chỉnh lịch tuần" : "Thêm lịch tuần"}
      onClose={close}
      busy={busy}
    >
      <form className={styles.form} onSubmit={submit}>
        <ErrorNotice error={error} />
        <fieldset
          disabled={busy}
          onChange={() => {
            setDirty(true);
            setPlan(null);
            setConfirmed(false);
          }}
        >
          <Field label="Ngày trong tuần">
            <select name="weekday" defaultValue={rule?.weekday || 1}>
              {weekdays.map((day, index) => (
                <option key={day} value={index + 1}>
                  {day}
                </option>
              ))}
            </select>
          </Field>
          <div className={styles.formGrid}>
            <Field label="Giờ bắt đầu">
              <input
                name="startTime"
                type="time"
                required
                step="60"
                defaultValue={rule?.startTime || "09:00"}
              />
            </Field>
            <Field label="Giờ kết thúc">
              <input
                name="endTime"
                type="time"
                required
                step="60"
                defaultValue={rule?.endTime || "10:00"}
              />
            </Field>
            <Field
              label={rule ? "Áp dụng thay đổi từ ngày" : "Có hiệu lực từ ngày"}
            >
              <input
                type="date"
                name="effectiveFrom"
                min={businessToday()}
                max={addDays(businessToday(), 366)}
                required
                defaultValue={
                  rule && rule.effectiveFrom > businessToday()
                    ? rule.effectiveFrom
                    : businessToday()
                }
              />
            </Field>
            <Field label="Ngày kết thúc" optional>
              <input
                type="date"
                name="effectiveTo"
                defaultValue={rule?.effectiveTo || ""}
              />
            </Field>
          </div>
          <Field label="Địa điểm" optional>
            <input
              name="location"
              maxLength={300}
              defaultValue={rule?.location ?? classroom.location ?? ""}
            />
          </Field>
          <label className={styles.check}>
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={rule?.isActive ?? true}
            />
            <span>Đang áp dụng lịch tuần này</span>
          </label>
          <p className={styles.hint}>
            Giờ Việt Nam (UTC+7), bắt đầu và kết thúc trong cùng ngày.
            {rule &&
              " Chỉ đổi các buổi tương lai đã sinh từ ngày áp dụng. Giữ buổi đã qua, chỉnh riêng, hủy hoặc có danh sách điểm danh. Bỏ chọn áp dụng sẽ hủy các buổi tương lai đủ điều kiện."}
          </p>
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
            onClick={close}
          >
            Đóng
          </button>
          <button
            className="button button-primary"
            disabled={busy || !!(plan?.conflictCount && !confirmed)}
          >
            {busy
              ? "Đang kiểm tra…"
              : !rule
                ? "Tạo lịch tuần"
                : plan
                  ? "Lưu thay đổi lịch tuần"
                  : "Xem trước thay đổi"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function GenerateEditor({
  classroom,
  onClose,
  onSaved,
}: {
  classroom: Classroom;
  onClose: () => void;
  onSaved: (value: SchedulePlan) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [plan, setPlan] = useState<SchedulePlan | null>(null),
    [confirmed, setConfirmed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<SchedulePlan>(
        `/classes/${classroom.id}/sessions/generate`,
        {
          from: String(form.get("from")),
          to: String(form.get("to")),
          preview: !plan,
          allowConflicts: confirmed,
          conflictKey: plan?.conflictKey,
        },
      );
      if (plan) onSaved(result);
      else {
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
    }
  }
  return (
    <Modal title="Sinh buổi từ lịch tuần" onClose={onClose} busy={busy}>
      <form className={styles.form} onSubmit={submit}>
        <ErrorNotice error={error} />
        <fieldset
          disabled={busy}
          onChange={() => {
            setPlan(null);
            setConfirmed(false);
          }}
        >
          <div className={styles.formGrid}>
            <Field label="Từ ngày">
              <input
                type="date"
                name="from"
                required
                min={businessToday()}
                max={addDays(businessToday(), 366)}
                defaultValue={businessToday()}
              />
            </Field>
            <Field label="Đến ngày">
              <input
                type="date"
                name="to"
                required
                min={businessToday()}
                max={addDays(businessToday(), 366)}
                defaultValue={addDays(businessToday(), 27)}
              />
            </Field>
          </div>
          <p className={styles.hint}>
            Tối đa 93 ngày/lần trong 366 ngày tới. Chỉ tạo giờ chưa qua, trong
            thời gian của lớp và hiệu lực của lịch tuần. Các buổi đã có được giữ
            nguyên.
          </p>
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
            className="button button-ghost"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            className="button button-primary"
            disabled={busy || !!(plan?.conflictCount && !confirmed)}
          >
            {busy
              ? "Đang kiểm tra…"
              : plan
                ? "Xác nhận sinh lịch"
                : "Xem trước các buổi"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
