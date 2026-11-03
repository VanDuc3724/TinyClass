import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
import { api } from "../lib/api";
import { dateLabel, dateTimeLabel } from "../lib/format";
import { useResource } from "../lib/hooks";
import {
  absenceLabels,
  moneyVnd,
  pricingLabels,
  timingLabels,
} from "../lib/tuition";
import type {
  PublicAgreement,
  TeacherAgreement,
  TuitionHistory,
  TuitionTerms,
} from "../lib/tuition";
import styles from "./Tuition.module.css";

export function TermsSummary({ terms }: { terms: TuitionTerms }) {
  const mode = terms.pricingMode;
  const amount =
    mode === "PER_SESSION"
      ? terms.sessionUnitPriceVnd
      : mode === "MONTHLY_FIXED"
        ? terms.monthlyAmountVnd
        : terms.programTotalVnd;
  return (
    <>
      <p className={styles.amount}>
        {moneyVnd(amount ?? 0)}{" "}
        <small>
          /{" "}
          {mode === "PER_SESSION"
            ? "buổi"
            : mode === "MONTHLY_FIXED"
              ? "tháng"
              : "khóa"}
        </small>
      </p>
      <dl className={styles.terms}>
        <div>
          <dt>Cách tính</dt>
          <dd>{pricingLabels[mode]}</dd>
        </div>
        <div>
          <dt>Thời điểm thu dự kiến</dt>
          <dd>{timingLabels[terms.collectionTiming]}</dd>
        </div>
        {mode === "PER_SESSION" ? (
          <>
            <div>
              <dt>Bé nghỉ có phép</dt>
              <dd>
                {terms.chargeExcusedAbsence
                  ? "Có tính phí buổi nghỉ"
                  : "Không tính phí buổi nghỉ"}
              </dd>
            </div>
            <div>
              <dt>Bé nghỉ chưa báo</dt>
              <dd>
                {terms.chargeUnexcusedAbsence
                  ? "Có tính phí buổi nghỉ"
                  : "Không tính phí buổi nghỉ"}
              </dd>
            </div>
          </>
        ) : (
          <div className={styles.full}>
            <dt>Khi bé nghỉ</dt>
            <dd>
              {terms.fixedFeeAbsenceRule
                ? absenceLabels[terms.fixedFeeAbsenceRule]
                : "Chưa đặt"}
            </dd>
          </div>
        )}
        {mode === "FULL_PROGRAM" && (
          <>
            <div>
              <dt>Tên khóa tính phí</dt>
              <dd>{terms.programLabel}</dd>
            </div>
            {terms.expectedSessions !== null && (
              <div>
                <dt>Số buổi dự kiến</dt>
                <dd>{terms.expectedSessions} buổi</dd>
              </div>
            )}
          </>
        )}
        {terms.publicTerms && (
          <div className={styles.full}>
            <dt>Điều kiện chia sẻ với gia đình</dt>
            <dd>{terms.publicTerms}</dd>
          </div>
        )}
      </dl>
    </>
  );
}
export function AgreementCard({
  agreement,
  teacher = false,
  pending = false,
  onAction,
}: {
  agreement: PublicAgreement | TeacherAgreement;
  teacher?: boolean;
  pending?: boolean;
  onAction?: (
    type: "replace" | "end" | "cancel" | "history",
    agreement: TeacherAgreement,
  ) => void;
}) {
  const privateRow = teacher ? (agreement as TeacherAgreement) : null;
  return (
    <article
      className={styles.card}
      aria-label={`Điều kiện từ ${dateLabel(agreement.effectiveFrom)}`}
    >
      <div className={styles.heading}>
        <div>
          <h3>{agreement.className}</h3>
          <p>
            {dateLabel(agreement.effectiveFrom)} –{" "}
            {agreement.effectiveTo
              ? dateLabel(agreement.effectiveTo)
              : "Chưa đặt ngày cuối"}{" "}
            (gồm ngày cuối)
          </p>
        </div>
        <Badge status={agreement.periodState} />
      </div>
      <TermsSummary terms={agreement} />
      {privateRow && (
        <>
          <p className="muted">
            {privateRow.sourceType === "POLICY"
              ? `Sao chép chính sách lớp · phiên bản ${privateRow.sourcePolicyVersion}`
              : "Thỏa thuận riêng cho bé"}
          </p>
          {privateRow.internalNote && (
            <p className={styles.private}>
              <strong>Ghi chú riêng của cô</strong>
              {privateRow.internalNote}
            </p>
          )}
          <div className={styles.actions}>
            {privateRow.status !== "CANCELLED" && (
              <Link
                className="button button-primary"
                to={`/teacher/invoices/new?agreement=${privateRow.id}`}
              >
                Lập phiếu
              </Link>
            )}
            {privateRow.canReplace && (
              <button
                className="button button-primary"
                disabled={pending}
                onClick={() => onAction?.("replace", privateRow)}
              >
                Thay mức học phí
              </button>
            )}
            {privateRow.canEnd && (
              <button
                className="button button-ghost"
                disabled={pending}
                onClick={() => onAction?.("end", privateRow)}
              >
                Kết thúc hiệu lực
              </button>
            )}
            {privateRow.canCancel && (
              <button
                className="button button-ghost"
                disabled={pending}
                onClick={() => onAction?.("cancel", privateRow)}
              >
                Hủy điều kiện
              </button>
            )}
            <button
              className="button button-ghost"
              disabled={pending}
              onClick={() => onAction?.("history", privateRow)}
            >
              Lịch sử thay đổi
            </button>
          </div>
          {privateRow.billedThrough && (
            <p className="muted">
              Đã có phiếu chưa hủy đến {dateLabel(privateRow.billedThrough)}.
              Giữ nguyên phần ngày đã lập phiếu.
            </p>
          )}
        </>
      )}
    </article>
  );
}
const actionLabels: Record<string, string> = {
  TUITION_POLICY_CREATED: "Thiết lập chính sách",
  TUITION_POLICY_UPDATED: "Cập nhật chính sách",
  TUITION_AGREEMENT_CREATED: "Lưu thỏa thuận",
  TUITION_AGREEMENT_REPLACED: "Thay mức học phí",
  TUITION_AGREEMENT_ENDED: "Kết thúc hiệu lực",
  TUITION_AGREEMENT_CANCELLED: "Hủy điều kiện",
};
export function TuitionHistoryModal({
  path,
  onClose,
}: {
  path: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.list<TuitionHistory>(`${path}?page=${page}&size=10`, signal),
      [path, page],
    ),
  );
  return (
    <Modal title="Lịch sử điều kiện học phí" wide onClose={onClose}>
      <p className="muted">Chỉ giáo viên xem được lý do và ghi chú riêng.</p>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            {!resource.data.data.length && (
              <EmptyState title="Chưa có thay đổi">
                Các lần lưu sẽ được ghi lại tại đây.
              </EmptyState>
            )}
            {resource.data.data.map((item) => (
              <article key={item.id} className={styles.history}>
                <h3>{actionLabels[item.action] || "Thay đổi điều kiện"}</h3>
                <p className="muted">
                  {item.actorName} · {dateTimeLabel(item.createdAt)}
                </p>
                {item.reason && (
                  <p className={styles.private}>
                    <strong>Lý do</strong>
                    {item.reason}
                  </p>
                )}
                {(["before", "after"] as const).map((key) => {
                  const value = item.changedFields[key];
                  return (
                    value?.pricingMode && (
                      <details key={key}>
                        <summary>
                          {key === "before" ? "Trước thay đổi" : "Sau thay đổi"}
                        </summary>
                        <TermsSummary terms={value as TuitionTerms} />
                        {value.effectiveFrom && (
                          <p>
                            {dateLabel(value.effectiveFrom)} –{" "}
                            {dateLabel(value.effectiveTo ?? null)}
                          </p>
                        )}
                        {value.status && <Badge status={value.status} />}
                        {value.internalNote && (
                          <p className={styles.private}>
                            <strong>Ghi chú riêng của cô</strong>
                            {value.internalNote}
                          </p>
                        )}
                      </details>
                    )
                  );
                })}
              </article>
            ))}
            <Pagination meta={resource.data.meta} onChange={setPage} />
          </>
        )
      )}
    </Modal>
  );
}
