import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ActionModal } from "../components/ActionModal";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Icon,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import type { Enrollment } from "../lib/types";
import type {
  EnrollmentWorkspace,
  FamilyTuitionWorkspace,
  PolicyWorkspace,
  TeacherAgreement,
} from "../lib/tuition";
import {
  AgreementCard,
  TermsSummary,
  TuitionHistoryModal,
} from "./TuitionParts";
import { EndTuitionModal, TuitionEditor } from "./TuitionEditors";
import styles from "./Tuition.module.css";

export function ClassTuitionPanel({ classId }: { classId: string }) {
  const [editing, setEditing] = useState(false),
    [history, setHistory] = useState(false),
    [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const resource = useResource(
    useCallback(
      (signal) =>
        api.get<PolicyWorkspace>(`/classes/${classId}/tuition-policy`, signal),
      [classId],
    ),
  );
  const members = useResource(
    useCallback(
      (signal) =>
        api.list<Enrollment>(
          `/classes/${classId}/enrollments?page=${page}&size=20`,
          signal,
        ),
      [classId, page],
    ),
  );
  if (resource.loading && !resource.data) return <Loading />;
  if (!resource.data || resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />;
  const data = resource.data;
  function refreshed(saved = false) {
    setEditing(false);
    resource.reload();
    if (saved)
      setNotice("Đã lưu chính sách. Các thỏa thuận của bé được giữ nguyên.");
  }
  return (
    <div className={styles.stack}>
      {notice && (
        <p className="info-notice" role="status">
          {notice}
        </p>
      )}
      <section className={styles.card}>
        <div className={styles.heading}>
          <div>
            <h2>Chính sách học phí của lớp</h2>
            <p>Mức mặc định khi cô tạo thỏa thuận cho từng bé.</p>
          </div>
          {data.canEdit && (
            <button
              className="button button-primary"
              disabled={resource.loading}
              onClick={() => setEditing(true)}
            >
              <Icon name="edit" />
              {data.policy ? "Chỉnh sửa chính sách" : "Thiết lập học phí"}
            </button>
          )}
        </div>
        {data.policy ? (
          <>
            <TermsSummary terms={data.policy} />
            {data.policy.internalNote && (
              <p className={styles.private}>
                <strong>Ghi chú riêng của cô</strong>
                {data.policy.internalNote}
              </p>
            )}
            <div className={styles.actions}>
              <button
                className="button button-ghost"
                onClick={() => setHistory(true)}
              >
                Lịch sử chính sách
              </button>
            </div>
          </>
        ) : (
          <p className="muted">
            Chưa có mức mặc định. Cô có thể thiết lập ở đây hoặc đặt mức riêng
            cho từng bé.
          </p>
        )}
        <p className={styles.information}>
          Đổi chính sách lớp không cập nhật các mức đã lưu cho bé. Điều kiện học
          phí chưa phải phiếu thu.
        </p>
      </section>
      <section className={styles.card}>
        <div className={styles.heading}>
          <div>
            <h2>Thỏa thuận của từng bé</h2>
            <p>Chọn bé để sao chép mức mặc định hoặc thiết lập riêng.</p>
          </div>
        </div>
        <ErrorNotice error={members.error} retry={members.reload} />
        {members.loading ? (
          <Loading />
        ) : (
          members.data && (
            <>
              {members.data.data.length ? (
                members.data.data.map((member) => (
                  <div className={styles.member} key={member.id}>
                    <div>
                      <strong>{member.studentName}</strong>
                      <Badge status={member.status} />
                    </div>
                    <Link
                      className="button button-ghost"
                      to={`/teacher/enrollments/${member.id}/tuition`}
                    >
                      Học phí của {member.studentName}
                      <Icon name="arrow" />
                    </Link>
                  </div>
                ))
              ) : (
                <EmptyState title="Lớp chưa có học sinh">
                  Thêm bé vào lớp để lưu thỏa thuận học phí.
                </EmptyState>
              )}
              <Pagination meta={members.data.meta} onChange={setPage} />
            </>
          )
        )}
      </section>
      {editing && (
        <TuitionEditor
          classId={classId}
          policy={data.policy}
          onClose={() => setEditing(false)}
          onSaved={() => refreshed(true)}
          onReload={() => refreshed()}
        />
      )}
      {history && (
        <TuitionHistoryModal
          path={`/classes/${classId}/tuition-policy/history`}
          onClose={() => setHistory(false)}
        />
      )}
    </div>
  );
}
export function EnrollmentTuitionPage() {
  const { enrollment } = useParams();
  return <EnrollmentTuitionContent key={enrollment} enrollment={enrollment!} />;
}
function EnrollmentTuitionContent({ enrollment }: { enrollment: string }) {
  const [page, setPage] = useState(0),
    [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{ agreement?: TeacherAgreement } | null>(
    null,
  );
  const [action, setAction] = useState<{
    type: "end" | "cancel" | "history";
    agreement: TeacherAgreement;
  } | null>(null);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.get<EnrollmentWorkspace>(
          `/enrollments/${enrollment}/tuition-agreements?page=${page}&size=10`,
          signal,
        ),
      [enrollment, page],
    ),
  );
  if (resource.loading && !resource.data) return <Loading />;
  if (!resource.data || resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />;
  const data = resource.data;
  function refresh(saved = false) {
    setEditor(null);
    setAction(null);
    resource.reload();
    if (saved) setNotice("Đã lưu điều kiện học phí.");
  }
  return (
    <>
      <Link
        className="back-link"
        to={`/teacher/classes/${data.enrollment.classId}?tab=tuition`}
      >
        ← Học phí của lớp
      </Link>
      <PageHeader
        eyebrow={data.enrollment.className}
        title={`Học phí · ${data.enrollment.studentName}`}
        description="Mức phí riêng và các khoảng ngày áp dụng của bé."
        action={
          data.canCreate && (
            <button
              className="button button-primary"
              disabled={resource.loading}
              onClick={() => setEditor({})}
            >
              <Icon name="plus" />
              Thêm thỏa thuận
            </button>
          )
        }
      />
      {notice && (
        <p role="status" className="info-notice">
          {notice}
        </p>
      )}
      <Link
        className="button button-ghost"
        to={`/teacher/invoices?enrollmentId=${enrollment}`}
      >
        Phiếu học phí của bé
      </Link>
      {!data.canCreate && (
        <p className={styles.information}>
          Lớp hoặc việc tham gia của bé đã dừng. Cô vẫn xem lịch sử và kết thúc
          phần hiệu lực tương lai.
        </p>
      )}
      <div className={styles.stack}>
        {data.agreements.data.length ? (
          data.agreements.data.map((agreement) => (
            <AgreementCard
              key={agreement.id}
              agreement={agreement}
              teacher
              pending={resource.loading}
              onAction={(type, row) =>
                type === "replace"
                  ? setEditor({ agreement: row })
                  : setAction({ type, agreement: row })
              }
            />
          ))
        ) : (
          <EmptyState title="Chưa có thỏa thuận học phí" icon="book">
            Cô chọn “Thêm thỏa thuận” để đặt mức phí và ngày áp dụng cho bé.
          </EmptyState>
        )}
      </div>
      <Pagination meta={data.agreements.meta} onChange={setPage} />
      {editor !== null && (
        <TuitionEditor
          policy={data.policy}
          workspace={data}
          agreement={editor.agreement}
          onClose={() => setEditor(null)}
          onSaved={() => refresh(true)}
          onReload={() => refresh()}
        />
      )}
      {action?.type === "history" && (
        <TuitionHistoryModal
          path={`/tuition-agreements/${action.agreement.id}/history`}
          onClose={() => setAction(null)}
        />
      )}
      {action?.type === "end" && (
        <EndTuitionModal
          agreement={action.agreement}
          today={data.businessDate}
          onClose={() => setAction(null)}
          onSaved={() => refresh(true)}
        />
      )}
      {action?.type === "cancel" && (
        <ActionModal
          action={{
            title: "Hủy điều kiện học phí",
            description:
              "Chỉ hủy điều kiện bắt đầu từ hôm nay hoặc tương lai. Bản gốc được giữ trong lịch sử; thao tác này không ghi nhận hoàn tiền.",
            label: "Xác nhận hủy điều kiện",
            reasonRequired: true,
            run: (reason) =>
              api.post(`/tuition-agreements/${action.agreement.id}/cancel`, {
                version: action.agreement.version,
                reason,
              }),
          }}
          onClose={() => setAction(null)}
          onSuccess={() => refresh(true)}
        />
      )}
    </>
  );
}
export function FamilyTuitionPage() {
  const { child } = useParams();
  return <FamilyTuitionContent key={child} child={child!} />;
}
function FamilyTuitionContent({ child }: { child: string }) {
  const [page, setPage] = useState(0);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.get<FamilyTuitionWorkspace>(
          `/family/children/${child}/tuition-agreements?page=${page}&size=10`,
          signal,
        ),
      [child, page],
    ),
  );
  if (resource.loading && !resource.data) return <Loading />;
  if (!resource.data || resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />;
  const data = resource.data;
  return (
    <>
      <Link className="back-link" to={`/family/children/${child}`}>
        ← Hồ sơ của bé
      </Link>
      <PageHeader
        eyebrow={`CÙNG GIA ĐÌNH ${data.student.fullName.toLocaleUpperCase("vi-VN")}`}
        title="Điều kiện học phí"
        description="Mức phí và thời gian áp dụng cô đã chia sẻ cho bé."
        action={
          <button className="button button-ghost" onClick={resource.reload}>
            Cập nhật
          </button>
        }
      />
      <Link
        className="button button-primary"
        to={`/family/children/${child}/invoices`}
      >
        Phiếu học phí của bé
      </Link>
      <p className={styles.information}>
        Gia đình có thể xem cả các thỏa thuận cũ để đối chiếu. Liên hệ cô nếu
        cần làm rõ mức phí hoặc quy tắc khi bé nghỉ.
      </p>
      <div className={styles.stack}>
        {data.agreements.data.length ? (
          data.agreements.data.map((agreement) => (
            <AgreementCard key={agreement.id} agreement={agreement} />
          ))
        ) : (
          <EmptyState title="Cô chưa chia sẻ điều kiện học phí" icon="book">
            Khi cô lưu mức phí cho bé, gia đình sẽ xem được tại đây.
          </EmptyState>
        )}
      </div>
      <Pagination meta={data.agreements.meta} onChange={setPage} />
    </>
  );
}
