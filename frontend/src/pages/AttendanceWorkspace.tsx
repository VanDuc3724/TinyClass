import { useCallback, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ActionModal } from "../components/ActionModal";
import type { ActionRequest } from "../components/ActionModal";
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  Loading,
  Modal,
  PageHeader,
} from "../components/ui";
import { api } from "../lib/api";
import { attendanceLabels, attendanceStates } from "../lib/attendance";
import type {
  AttendanceStatus,
  AttendanceWorkspace,
  TeacherAttendance,
} from "../lib/attendance";
import { dateTimeLabel } from "../lib/format";
import { useResource, useUnsavedChanges } from "../lib/hooks";
import { AttendanceHistory } from "./AttendanceParts";
import styles from "./Attendance.module.css";

type Draft = { status: AttendanceStatus; note: string; familyNote: string };
const draftOf = (row: TeacherAttendance): Draft => ({
  status: row.status,
  note: row.note || "",
  familyNote: row.familyNote || "",
});
const differs = (draft: Draft, row: TeacherAttendance) =>
  draft.status !== row.status ||
  draft.note.trim() !== (row.note || "") ||
  draft.familyNote.trim() !== (row.familyNote || "");

export default function AttendanceWorkspacePage() {
  const { session } = useParams();
  const resource = useResource(
    useCallback(
      (signal) =>
        api.get<AttendanceWorkspace>(`/sessions/${session}/attendance`, signal),
      [session],
    ),
  );
  const [saved, setSaved] = useState<AttendanceWorkspace | null>(null),
    [revision, setRevision] = useState(0),
    [notice, setNotice] = useState("");
  const data =
    resource.data &&
    (saved &&
    saved.session.id === session &&
    saved.session.version >= resource.data.session.version
      ? saved
      : resource.data);
  return (
    <>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {!data ? (
        resource.loading ? (
          <Loading />
        ) : (
          <Link className="back-link" to="/teacher/schedule">
            ← Về lịch dạy
          </Link>
        )
      ) : (
        <AttendanceEditor
          key={`${session}:${data.session.version}:${revision}`}
          data={data}
          notice={notice}
          onSaved={(value, message) => {
            setSaved(value);
            setNotice(message);
            setRevision((value) => value + 1);
          }}
          onReload={() => {
            setSaved(null);
            setNotice("");
            setRevision((value) => value + 1);
            resource.reload();
          }}
        />
      )}
    </>
  );
}

function AttendanceEditor({
  data,
  notice,
  onSaved,
  onReload,
}: {
  data: AttendanceWorkspace;
  notice: string;
  onSaved: (value: AttendanceWorkspace, message: string) => void;
  onReload: () => void;
}) {
  const { session, rows } = data;
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, draftOf(row)])),
  );
  const [reason, setReason] = useState(""),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const [action, setAction] = useState<ActionRequest | null>(null),
    [adding, setAdding] = useState(false),
    [history, setHistory] = useState<TeacherAttendance | null>(null);
  const actionResult = useRef<AttendanceWorkspace | null>(null);
  const active = rows.filter((row) => row.isActive),
    inactive = rows.filter((row) => !row.isActive);
  const changed = active.filter((row) => differs(drafts[row.id], row)),
    dirty = changed.length > 0;
  const confirmDiscard = useUnsavedChanges(dirty);
  const needsReason = changed.some((row) => row.status !== "UNMARKED");
  const visible = active.filter((row) =>
    row.studentName
      .toLocaleLowerCase("vi-VN")
      .includes(search.trim().toLocaleLowerCase("vi-VN")),
  );
  const candidates = data.eligibleMembers.filter(
    (member) => !active.some((row) => row.studentId === member.studentId),
  );
  function change(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!dirty || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.put<AttendanceWorkspace>(
        `/sessions/${session.id}/attendance`,
        {
          sessionVersion: session.version,
          reason: reason.trim(),
          rows: changed.map((row) => ({
            id: row.id,
            version: row.version,
            ...drafts[row.id],
          })),
        },
      );
      onSaved(updated, "Đã lưu kết quả điểm danh.");
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  function openAction(request: ActionRequest) {
    actionResult.current = null;
    setAction(request);
  }
  return (
    <>
      <Link
        className="back-link"
        to={`/teacher/schedule/sessions/${session.id}`}
        onClick={(event) => {
          if (!confirmDiscard()) event.preventDefault();
        }}
      >
        ← Về buổi học
      </Link>
      <PageHeader
        eyebrow={session.className}
        title={`Điểm danh · ${session.title}`}
        description={`${dateTimeLabel(session.startsAt)} – ${dateTimeLabel(session.endsAt)} · Giờ Việt Nam`}
        action={<Badge status={session.status} />}
      />
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {session.status === "CANCELLED" && (
        <p className={styles.warning}>
          Buổi đã hủy:{" "}
          {session.cancellationReason || "Giáo viên đã hủy buổi này."} Kết quả
          cũ được giữ để đối chiếu và không tính là một buổi tham gia.
        </p>
      )}
      {!data.canEdit && session.status !== "CANCELLED" && (
        <p className={styles.information}>
          Kết quả được giữ để xem lại. Buổi này hiện không cho phép sửa điểm
          danh.
        </p>
      )}
      {!data.canMarkPresent && data.canEdit && (
        <p className={styles.information}>
          Chỉ đánh dấu có mặt hoặc đi muộn khi buổi học đã bắt đầu. Bạn có thể
          ghi nhận báo nghỉ trước.
        </p>
      )}
      {!!data.billingReferences?.length && (
        <div className={styles.warning}>
          Buổi này đã được giữ/tính trong phiếu học phí. Sửa điểm danh sẽ không
          đổi số tiền đã phát hành; cô cần đối chiếu các phiếu liên quan.
          <div className="row-actions">
            {data.billingReferences.map((invoice) => (
              <Link key={invoice.id} to={`/teacher/invoices/${invoice.id}`}>
                {invoice.invoiceCode}
              </Link>
            ))}
          </div>
        </div>
      )}
      {data.hasRoster && (
        <div className={styles.summary} aria-label="Kết quả đã lưu">
          <section className={styles.stat}>
            <p>Có mặt</p>
            <strong>{data.counts.PRESENT + data.counts.LATE}</strong>
            <small>Gồm {data.counts.LATE} bé đi muộn</small>
          </section>
          <section className={styles.stat}>
            <p>Vắng mặt</p>
            <strong>
              {data.counts.ABSENT_EXCUSED + data.counts.ABSENT_UNEXCUSED}
            </strong>
            <small>{data.counts.ABSENT_EXCUSED} bé nghỉ có phép</small>
          </section>
          <section className={styles.stat}>
            <p>Chưa đánh dấu</p>
            <strong>{data.counts.UNMARKED}</strong>
            <small>{data.counts.effectiveTotal} bé trong buổi</small>
          </section>
        </div>
      )}
      <div className={styles.toolbar}>
        {data.hasRoster && (
          <input
            type="search"
            aria-label="Tìm bé trong danh sách"
            placeholder="Tìm bé trong danh sách…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        )}
        <div>
          <button
            type="button"
            className="button button-ghost"
            disabled={busy}
            onClick={() => {
              if (confirmDiscard()) onReload();
            }}
          >
            Cập nhật kết quả
          </button>
          {data.hasRoster && data.canEdit && (
            <>
              <button
                type="button"
                className="button button-ghost"
                disabled={busy || dirty || !candidates.length}
                onClick={() => setAdding(true)}
              >
                <Icon name="plus" />
                Bổ sung bé
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={
                  busy ||
                  !data.canMarkPresent ||
                  !active.some((row) => drafts[row.id].status === "UNMARKED")
                }
                onClick={() =>
                  setDrafts((current) =>
                    Object.fromEntries(
                      Object.entries(current).map(([id, draft]) => [
                        id,
                        active.some((row) => row.id === id) &&
                        draft.status === "UNMARKED"
                          ? { ...draft, status: "PRESENT" }
                          : draft,
                      ]),
                    ),
                  )
                }
              >
                Đánh dấu các bé còn lại có mặt
              </button>
            </>
          )}
        </div>
      </div>
      {!data.hasRoster ? (
        <section className="panel">
          <EmptyState
            icon="students"
            title="Chuẩn bị danh sách cho buổi học"
            action={
              data.canEdit && (
                <button
                  className="button button-primary"
                  onClick={() =>
                    openAction({
                      title: "Chốt danh sách điểm danh",
                      description:
                        "Lấy danh sách bé hiện đủ điều kiện trong lớp. Sau khi chốt, thay đổi thành viên lớp sẽ không tự sửa danh sách buổi này; bạn có thể bổ sung hoặc loại bé kèm lý do.",
                      label: "Chốt danh sách",
                      run: async () => {
                        actionResult.current = await api.post(
                          `/sessions/${session.id}/attendance-roster`,
                          { sessionVersion: session.version },
                        );
                      },
                    })
                  }
                >
                  Chốt danh sách điểm danh
                </button>
              )
            }
          >
            Danh sách được giữ riêng cho từng buổi để bảo toàn kết quả cũ.
          </EmptyState>
        </section>
      ) : (
        <>
          <form onSubmit={save}>
            <ErrorNotice error={error} />
            {active.length === 0 ? (
              <section className="panel">
                <EmptyState title="Danh sách buổi đang trống" icon="students">
                  Bổ sung bé nếu cần, hoặc hoàn thành buổi kèm lý do.
                </EmptyState>
              </section>
            ) : visible.length === 0 ? (
              <p className={styles.information}>Không tìm thấy bé phù hợp.</p>
            ) : (
              <div className={styles.roster}>
                {visible.map((row) => (
                  <article
                    key={row.id}
                    className={styles.row}
                    aria-label={`Điểm danh ${row.studentName}`}
                  >
                    <div className={styles.rowHeader}>
                      <Avatar name={row.studentName} />
                      <div>
                        <h2>
                          <Link
                            className="text-link"
                            to={`/teacher/students/${row.studentId}`}
                            onClick={(event) => {
                              if (!confirmDiscard()) event.preventDefault();
                            }}
                          >
                            {row.studentName}
                          </Link>
                        </h2>
                        <div className={styles.rowMeta}>
                          <Badge status={row.status} />
                          {differs(drafts[row.id], row) && (
                            <span className={styles.draft}>
                              Có thay đổi chưa lưu
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {(row.enrollmentStatus !== "ACTIVE" ||
                      row.studentStatus !== "ACTIVE") && (
                      <p className="muted">
                        Hồ sơ hoặc việc tham gia lớp đã thay đổi. Kết quả của
                        buổi vẫn được giữ.
                      </p>
                    )}
                    <Field label="Trạng thái điểm danh">
                      <select
                        value={drafts[row.id].status}
                        disabled={busy || !data.canEdit}
                        onChange={(event) =>
                          change(row.id, {
                            status: event.target.value as AttendanceStatus,
                          })
                        }
                      >
                        {attendanceStates.map((status) => (
                          <option
                            key={status}
                            value={status}
                            disabled={
                              !data.canMarkPresent &&
                              (status === "PRESENT" || status === "LATE")
                            }
                          >
                            {attendanceLabels[status]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <details>
                      <summary>Ghi chú riêng và gửi gia đình</summary>
                      <Field
                        label="Ghi chú riêng của cô"
                        optional
                        hint="Chỉ giáo viên xem được."
                      >
                        <textarea
                          value={drafts[row.id].note}
                          rows={2}
                          maxLength={1000}
                          disabled={busy || !data.canEdit}
                          onChange={(event) =>
                            change(row.id, { note: event.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="Ghi chú gửi gia đình"
                        optional
                        hint="Phụ huynh được liên kết với bé sẽ xem được phần này."
                      >
                        <textarea
                          value={drafts[row.id].familyNote}
                          rows={2}
                          maxLength={1000}
                          disabled={busy || !data.canEdit}
                          onChange={(event) =>
                            change(row.id, { familyNote: event.target.value })
                          }
                        />
                      </Field>
                    </details>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setHistory(row)}
                      >
                        Lịch sử điểm danh
                      </button>
                      {data.canEdit && (
                        <button
                          type="button"
                          className="text-button"
                          disabled={busy || dirty}
                          onClick={() =>
                            openAction({
                              title: `Loại ${row.studentName} khỏi buổi`,
                              description:
                                "Giữ kết quả cũ trong lịch sử, ngừng tính bé vào danh sách của buổi. Việc tham gia lớp của bé không thay đổi.",
                              label: "Loại khỏi danh sách buổi",
                              reasonRequired: true,
                              run: async (reason) => {
                                actionResult.current = await api.post(
                                  `/sessions/${session.id}/attendance-roster/members`,
                                  {
                                    sessionVersion: session.version,
                                    studentId: row.studentId,
                                    action: "REMOVE",
                                    reason,
                                  },
                                );
                              },
                            })
                          }
                        >
                          Loại khỏi buổi
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            {data.canEdit && (
              <section className={styles.save} aria-label="Lưu điểm danh">
                <h2>
                  {dirty
                    ? `${changed.length} bé có thay đổi chưa lưu`
                    : "Kết quả điểm danh đã lưu"}
                </h2>
                <p>
                  Thao tác đánh dấu nhanh chỉ điền những bé chưa được chọn trạng
                  thái. Lưu kết quả trước khi điều chỉnh danh sách hoặc hoàn
                  thành buổi.
                </p>
                {dirty && (
                  <Field
                    label="Lý do điều chỉnh"
                    optional={!needsReason}
                    hint={
                      needsReason
                        ? "Cần lý do khi sửa kết quả đã đánh dấu trước đó. Chỉ giáo viên xem được."
                        : "Có thể ghi thêm để đối chiếu sau này. Chỉ giáo viên xem được."
                    }
                  >
                    <textarea
                      value={reason}
                      rows={2}
                      maxLength={1000}
                      required={needsReason}
                      disabled={busy}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </Field>
                )}
                <div className={styles.saveActions}>
                  <button
                    type="button"
                    className="button button-ghost"
                    disabled={busy || !dirty}
                    onClick={() => {
                      if (confirmDiscard()) {
                        setDrafts(
                          Object.fromEntries(
                            rows.map((row) => [row.id, draftOf(row)]),
                          ),
                        );
                        setReason("");
                        setError(null);
                      }
                    }}
                  >
                    Bỏ thay đổi
                  </button>
                  <button
                    className="button button-primary"
                    disabled={busy || !dirty}
                  >
                    {busy ? "Đang lưu…" : `Lưu ${changed.length} thay đổi`}
                  </button>
                </div>
              </section>
            )}
          </form>
          {inactive.length > 0 && (
            <details className={styles.inactive}>
              <summary>
                {inactive.length} bé đã loại khỏi danh sách buổi
              </summary>
              <div className={styles.roster}>
                {inactive.map((row) => (
                  <article className={styles.row} key={row.id}>
                    <h2>{row.studentName}</h2>
                    <Badge status={row.status} />
                    <p className="muted">
                      Giữ để đối chiếu, không tính trong kết quả buổi.
                    </p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setHistory(row)}
                    >
                      Lịch sử điểm danh
                    </button>
                  </article>
                ))}
              </div>
            </details>
          )}
          {data.canEdit && session.status !== "COMPLETED" && (
            <section className={styles.save}>
              <h2>Hoàn thành buổi học</h2>
              <p>
                Thực hiện sau giờ kết thúc và khi tất cả bé trong danh sách đã
                được đánh dấu. Nếu đưa một bé về trạng thái chưa đánh dấu sau
                khi hoàn thành, buổi sẽ mở lại để xử lý tiếp.
              </p>
              <button
                className="button button-primary"
                disabled={busy || dirty || !data.canComplete}
                onClick={() =>
                  openAction({
                    title: "Hoàn thành buổi học",
                    description: active.length
                      ? "Xác nhận kết quả của buổi đã đầy đủ. Bạn vẫn có thể sửa kết quả sau này kèm lý do."
                      : "Buổi không có bé trong danh sách. Ghi rõ lý do để đối chiếu sau này.",
                    label: "Xác nhận hoàn thành",
                    reasonRequired: !active.length,
                    run: async (reason) => {
                      actionResult.current = await api.post(
                        `/sessions/${session.id}/complete`,
                        { version: session.version, reason },
                      );
                    },
                  })
                }
              >
                Hoàn thành buổi học
              </button>
            </section>
          )}
        </>
      )}
      {history && (
        <AttendanceHistory
          id={history.id}
          name={history.studentName}
          onClose={() => setHistory(null)}
        />
      )}
      {action && (
        <ActionModal
          action={action}
          onClose={() => setAction(null)}
          onSuccess={() => {
            if (actionResult.current)
              onSaved(actionResult.current, "Đã cập nhật buổi học.");
            setAction(null);
          }}
        />
      )}
      {adding && (
        <AddAttendanceMember
          data={data}
          candidates={candidates}
          onClose={() => setAdding(false)}
          onSaved={(value) =>
            onSaved(value, "Đã bổ sung bé vào danh sách buổi.")
          }
        />
      )}
    </>
  );
}

function AddAttendanceMember({
  data,
  candidates,
  onClose,
  onSaved,
}: {
  data: AttendanceWorkspace;
  candidates: AttendanceWorkspace["eligibleMembers"];
  onClose: () => void;
  onSaved: (value: AttendanceWorkspace) => void;
}) {
  const [studentId, setStudentId] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const confirmDiscard = useUnsavedChanges(!!studentId || !!reason);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await api.post(
          `/sessions/${data.session.id}/attendance-roster/members`,
          {
            sessionVersion: data.session.version,
            studentId,
            action: "ADD",
            reason: reason.trim(),
          },
        ),
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Bổ sung bé vào buổi học"
      onClose={() => {
        if (confirmDiscard()) onClose();
      }}
      busy={busy}
    >
      <p className="muted">
        Chọn bé thuộc lớp này. Nếu bé từng bị loại khỏi buổi, kết quả cũ sẽ được
        giữ khi bổ sung lại.
      </p>
      <form onSubmit={submit}>
        <ErrorNotice error={error} />
        <Field label="Bé cần bổ sung">
          <select
            required
            value={studentId}
            disabled={busy}
            onChange={(event) => setStudentId(event.target.value)}
          >
            <option value="">Chọn bé…</option>
            {candidates.map((member) => (
              <option key={member.id} value={member.studentId}>
                {member.fullName}
                {member.enrollmentStatus !== "ACTIVE" ||
                member.studentStatus !== "ACTIVE"
                  ? " · Hồ sơ cũ của lớp"
                  : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lý do bổ sung">
          <textarea
            required
            rows={3}
            maxLength={1000}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <div className="form-actions">
          <button
            type="button"
            className="button button-ghost"
            disabled={busy}
            onClick={() => {
              if (confirmDiscard()) onClose();
            }}
          >
            Hủy
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Bổ sung bé"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
