import { useCallback, useState } from "react";
import {
  Badge,
  ErrorNotice,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
import { api } from "../lib/api";
import { dateTimeLabel } from "../lib/format";
import { useResource } from "../lib/hooks";
import { attendanceLabels } from "../lib/attendance";
import type { AttendanceEvent } from "../lib/attendance";
import styles from "./Attendance.module.css";

export function AttendanceHistory({
  id,
  name,
  child,
  onClose,
}: {
  id: string;
  name: string;
  child?: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.list<AttendanceEvent>(
          `${child ? `/family/children/${child}` : ""}/attendance/${id}/history?page=${page}&size=10`,
          signal,
        ),
      [child, id, page],
    ),
  );
  const eventLabels: Record<string, string> = {
    CREATED: "Có trong danh sách ban đầu",
    ADDED: "Bổ sung vào danh sách",
    REMOVED: "Loại khỏi danh sách buổi",
    UPDATED: "Cập nhật điểm danh",
  };
  return (
    <Modal title={`Lịch sử điểm danh · ${name}`} onClose={onClose}>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && !resource.data ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            <ol className={styles.historyList}>
              {resource.data.data.map((event) => (
                <li key={event.id}>
                  <strong>
                    {eventLabels[event.eventType] || "Thay đổi điểm danh"}
                  </strong>
                  <p>
                    {event.statusBefore &&
                    event.statusBefore !== event.statusAfter
                      ? `${attendanceLabels[event.statusBefore]} → `
                      : ""}
                    <Badge status={event.statusAfter} />
                  </p>
                  <small>
                    {dateTimeLabel(event.createdAt)} · {event.actorName}
                  </small>
                  {event.familyNote && <p>Gửi gia đình: {event.familyNote}</p>}
                  {!child && event.reason && <p>Lý do: {event.reason}</p>}
                </li>
              ))}
            </ol>
            <Pagination meta={resource.data.meta} onChange={setPage} />
          </>
        )
      )}
    </Modal>
  );
}
