import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ErrorNotice, Field, Modal } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { businessToday } from "../lib/format";
import { businessLocal } from "../lib/schedule";
import { useUnsavedChanges } from "../lib/hooks";
import {
  absenceLabels,
  pricingLabels,
  timingLabels,
  tuitionChangeMinimum,
} from "../lib/tuition";
import type {
  EnrollmentWorkspace,
  TeacherAgreement,
  TuitionPolicy,
  TuitionTerms,
} from "../lib/tuition";
import { TermsSummary } from "./TuitionParts";
import styles from "./Tuition.module.css";

type Draft = {
  mode: string;
  timing: string;
  amount: string;
  program: string;
  sessions: string;
  excused: string;
  unexcused: string;
  rule: string;
  publicTerms: string;
};
function draftOf(terms?: TuitionTerms | null): Draft {
  return {
    mode: terms?.pricingMode || "",
    timing: terms?.collectionTiming || "",
    amount: String(
      terms?.sessionUnitPriceVnd ??
        terms?.monthlyAmountVnd ??
        terms?.programTotalVnd ??
        "",
    ),
    program: terms?.programLabel || "",
    sessions: String(terms?.expectedSessions ?? ""),
    excused:
      terms?.chargeExcusedAbsence == null
        ? ""
        : String(terms.chargeExcusedAbsence),
    unexcused:
      terms?.chargeUnexcusedAbsence == null
        ? ""
        : String(terms.chargeUnexcusedAbsence),
    rule: terms?.fixedFeeAbsenceRule || "",
    publicTerms: terms?.publicTerms || "",
  };
}
function termsOf(draft: Draft) {
  const session = draft.mode === "PER_SESSION",
    monthly = draft.mode === "MONTHLY_FIXED",
    program = draft.mode === "FULL_PROGRAM";
  const amount = draft.amount === "" ? null : Number(draft.amount);
  return {
    pricingMode: draft.mode,
    collectionTiming: draft.timing,
    sessionUnitPriceVnd: session ? amount : null,
    monthlyAmountVnd: monthly ? amount : null,
    programTotalVnd: program ? amount : null,
    programLabel: program ? draft.program.trim() : null,
    expectedSessions:
      program && draft.sessions !== "" ? Number(draft.sessions) : null,
    chargeExcusedAbsence: session
      ? draft.excused === ""
        ? null
        : draft.excused === "true"
      : null,
    chargeUnexcusedAbsence: session
      ? draft.unexcused === ""
        ? null
        : draft.unexcused === "true"
      : null,
    fixedFeeAbsenceRule: session ? null : draft.rule,
    publicTerms: draft.publicTerms.trim() || null,
  };
}
function TermsFields({
  value,
  onChange,
  disabled,
}: {
  value: Draft;
  onChange: (value: Draft) => void;
  disabled: boolean;
}) {
  function update(key: keyof Draft, data: string) {
    onChange({ ...value, [key]: data });
  }
  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend>Điều kiện học phí</legend>
      <div className={styles.grid}>
        <Field label="Cách tính học phí">
          <select
            required
            value={value.mode}
            onChange={(e) =>
              onChange({
                ...value,
                mode: e.target.value,
                amount: "",
                program: "",
                sessions: "",
                excused: "",
                unexcused: "",
                rule: "",
              })
            }
          >
            <option value="">Chọn cách tính…</option>
            {Object.entries(pricingLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Thời điểm thu dự kiến">
          <select
            required
            value={value.timing}
            onChange={(e) => update("timing", e.target.value)}
          >
            <option value="">Chọn thời điểm…</option>
            {Object.entries(timingLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {value.mode && (
          <Field
            label={
              value.mode === "PER_SESSION"
                ? "Đơn giá mỗi buổi (VND)"
                : value.mode === "MONTHLY_FIXED"
                  ? "Mức phí mỗi tháng (VND)"
                  : "Tổng phí trọn khóa (VND)"
            }
            hint="Số nguyên từ 0 đến 1.000.000.000.000 VND."
          >
            <input
              type="number"
              required
              min="0"
              max="1000000000000"
              step="1"
              value={value.amount}
              onChange={(e) => update("amount", e.target.value)}
            />
          </Field>
        )}
        {value.mode === "PER_SESSION" && (
          <>
            <Field label="Bé nghỉ có phép">
              <select
                required
                value={value.excused}
                onChange={(e) => update("excused", e.target.value)}
              >
                <option value="">Chọn quy tắc…</option>
                <option value="true">Có tính phí buổi nghỉ</option>
                <option value="false">Không tính phí buổi nghỉ</option>
              </select>
            </Field>
            <Field label="Bé nghỉ chưa báo">
              <select
                required
                value={value.unexcused}
                onChange={(e) => update("unexcused", e.target.value)}
              >
                <option value="">Chọn quy tắc…</option>
                <option value="true">Có tính phí buổi nghỉ</option>
                <option value="false">Không tính phí buổi nghỉ</option>
              </select>
            </Field>
          </>
        )}
        {value.mode && value.mode !== "PER_SESSION" && (
          <Field label="Quy tắc khi bé nghỉ">
            <select
              required
              value={value.rule}
              onChange={(e) => update("rule", e.target.value)}
            >
              <option value="">Chọn quy tắc…</option>
              {Object.entries(absenceLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {value.mode === "FULL_PROGRAM" && (
          <>
            <Field label="Tên khóa tính phí">
              <input
                required
                maxLength={200}
                value={value.program}
                onChange={(e) => update("program", e.target.value)}
              />
            </Field>
            <Field label="Số buổi dự kiến" optional>
              <input
                type="number"
                min="1"
                max="10000"
                step="1"
                value={value.sessions}
                onChange={(e) => update("sessions", e.target.value)}
              />
            </Field>
          </>
        )}
      </div>
      <Field label="Điều kiện chia sẻ với gia đình" optional>
        <textarea
          rows={3}
          maxLength={5000}
          value={value.publicTerms}
          onChange={(e) => update("publicTerms", e.target.value)}
        />
      </Field>
    </fieldset>
  );
}
export function TuitionEditor({
  classId,
  policy,
  workspace,
  agreement,
  onClose,
  onSaved,
  onReload,
}: {
  classId?: string;
  policy: TuitionPolicy | null;
  workspace?: EnrollmentWorkspace;
  agreement?: TeacherAgreement;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const isPolicy = !!classId;
  const [initial] = useState(() => draftOf(agreement || policy));
  const [draft, setDraft] = useState(initial);
  const [initialSource] = useState(() =>
    !agreement && policy ? "POLICY" : "CUSTOM",
  );
  const [source, setSource] = useState(initialSource);
  const [initialFrom] = useState(() =>
    [
      workspace?.businessDate || businessToday(),
      workspace
        ? businessLocal(workspace.enrollment.joinedAt).slice(0, 10)
        : "",
      workspace?.enrollment.classStartDate || "",
      agreement?.effectiveFrom || "",
    ]
      .sort()
      .at(-1)!,
  );
  const [from, setFrom] = useState(initialFrom);
  const [initialTo] = useState(
    () => agreement?.effectiveTo || workspace?.enrollment.classEndDate || "",
  );
  const [to, setTo] = useState(initialTo);
  const [note, setNote] = useState(isPolicy ? policy?.internalNote || "" : "");
  const [reason, setReason] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error && !(error instanceof ApiError && error.fieldErrors.length)) {
      anchor.current?.scrollIntoView({ block: "start" });
      anchor.current?.focus({ preventScroll: true });
    }
  }, [error]);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initial) ||
    source !== initialSource ||
    from !== initialFrom ||
    to !== initialTo ||
    note !== (isPolicy ? policy?.internalNote || "" : "") ||
    !!reason;
  const discard = useUnsavedChanges(dirty);
  function close() {
    if (!busy && discard()) onClose();
  }
  function reload() {
    if (!busy && discard()) onReload();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (isPolicy)
        await api.put(`/classes/${classId}/tuition-policy`, {
          version: policy?.version ?? null,
          terms: termsOf(draft),
          internalNote: note.trim() || null,
          reason: reason.trim() || null,
        });
      else if (workspace)
        await api.post(
          agreement
            ? `/tuition-agreements/${agreement.id}/replace`
            : `/enrollments/${workspace.enrollment.id}/tuition-agreements`,
          {
            clientRequestId: requestId,
            source,
            policyVersion: source === "POLICY" ? policy?.version : null,
            terms: source === "CUSTOM" ? termsOf(draft) : null,
            effectiveFrom: from,
            effectiveTo: to || null,
            internalNote: note.trim() || null,
            reason: reason.trim() || null,
            version: agreement?.version ?? null,
          },
        );
      onSaved();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  const minimum = agreement
    ? tuitionChangeMinimum(
        agreement,
        workspace?.businessDate || businessToday(),
      )
    : [
        "1900-01-01",
        workspace
          ? businessLocal(workspace.enrollment.joinedAt).slice(0, 10)
          : "",
        workspace?.enrollment.classStartDate || "",
      ]
        .sort()
        .at(-1)!;
  return (
    <Modal
      title={
        isPolicy
          ? "Chính sách học phí của lớp"
          : agreement
            ? "Thay mức học phí"
            : "Thỏa thuận học phí cho bé"
      }
      onClose={close}
      busy={busy}
      wide
    >
      <p className={styles.information}>
        {isPolicy
          ? "Mức mặc định để sao chép khi tạo thỏa thuận. Thay đổi tại đây không đổi mức đã lưu cho các bé."
          : "Sau khi lưu, gia đình được xem mức phí, ngày áp dụng và điều kiện chia sẻ. Ghi chú riêng và lý do chỉ cô xem được."}
      </p>
      {agreement && (
        <p className="muted">
          Bản cũ kết thúc trước ngày đổi mức. Nếu đổi ngay ngày bắt đầu, bản cũ
          được giữ trong lịch sử với trạng thái đã hủy.
        </p>
      )}
      <form onSubmit={submit}>
        <div ref={anchor} tabIndex={-1} className={styles.errorAnchor}>
          <ErrorNotice error={error} />
        </div>
        {!isPolicy && (
          <Field label="Nguồn điều kiện">
            <select
              disabled={busy}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="CUSTOM">Thiết lập riêng cho bé</option>
              {policy && (
                <option value="POLICY">Sao chép chính sách lớp</option>
              )}
            </select>
          </Field>
        )}
        {!isPolicy && source === "POLICY" && policy ? (
          <div className={styles.source}>
            <TermsSummary terms={policy} />
          </div>
        ) : (
          <TermsFields value={draft} onChange={setDraft} disabled={busy} />
        )}
        {!isPolicy && (
          <div className={styles.grid}>
            <Field label="Ngày bắt đầu áp dụng">
              <input
                type="date"
                required
                disabled={busy}
                min={minimum}
                max={
                  agreement?.effectiveTo ||
                  workspace?.enrollment.classEndDate ||
                  "2200-12-31"
                }
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field
              label="Ngày cuối áp dụng"
              optional={!workspace?.enrollment.classEndDate}
              hint="Bao gồm cả ngày này; để trống nếu chưa đặt ngày cuối."
            >
              <input
                type="date"
                required={!!workspace?.enrollment.classEndDate}
                disabled={busy}
                min={from || minimum}
                max={workspace?.enrollment.classEndDate || "2200-12-31"}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
        )}
        <Field label="Ghi chú riêng của cô" optional>
          <textarea
            rows={3}
            maxLength={5000}
            disabled={busy}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        {(agreement || (isPolicy && policy)) && (
          <Field label="Lý do thay đổi">
            <textarea
              required
              rows={2}
              maxLength={1000}
              disabled={busy}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        )}
        {!!error && (
          <button
            type="button"
            disabled={busy}
            className="button button-ghost"
            onClick={reload}
          >
            Đóng và cập nhật dữ liệu
          </button>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button button-ghost"
            disabled={busy}
            onClick={close}
          >
            Hủy
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy
              ? "Đang lưu…"
              : isPolicy
                ? "Lưu chính sách"
                : "Lưu và chia sẻ điều kiện"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function EndTuitionModal({
  agreement,
  today,
  onClose,
  onSaved,
}: {
  agreement: TeacherAgreement;
  today: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const minimum = [
    today,
    agreement.effectiveFrom,
    agreement.billedThrough || "",
  ]
    .sort()
    .at(-1)!;
  const [to, setTo] = useState(minimum),
    [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const discard = useUnsavedChanges(to !== minimum || !!reason);
  function close() {
    if (!busy && discard()) onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/tuition-agreements/${agreement.id}/end`, {
        version: agreement.version,
        effectiveTo: to,
        reason: reason.trim(),
      });
      onSaved();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Kết thúc hiệu lực học phí" onClose={close} busy={busy}>
      <p className="muted">
        Chọn ngày cuối còn áp dụng. Các ngày đã qua và bản thỏa thuận vẫn được
        giữ lại.
      </p>
      <form onSubmit={submit}>
        <ErrorNotice error={error} />
        <Field label="Ngày cuối áp dụng">
          <input
            type="date"
            required
            min={minimum}
            max={agreement.effectiveTo || "2200-12-31"}
            disabled={busy}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Field label="Lý do">
          <textarea
            required
            maxLength={1000}
            rows={3}
            disabled={busy}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className="form-actions">
          <button
            type="button"
            className="button button-ghost"
            disabled={busy}
            onClick={close}
          >
            Hủy
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Xác nhận kết thúc"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
