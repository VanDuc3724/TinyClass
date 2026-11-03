export const statusLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  ISSUED: "Đã phát hành",
  RECORDED: "Đã ghi nhận",
  VOIDED: "Đã hủy bản ghi",
  UNPAID: "Chưa thu",
  PARTIAL: "Đã thu một phần",
  PAID: "Đã thu đủ",
  NO_PAYMENT_DUE: "Không cần thu",
  ACTIVE: "Đang hoạt động",
  COMPLETED: "Đã hoàn thành",
  ARCHIVED: "Đã lưu trữ",
  WITHDRAWN: "Đã rời lớp",
  PENDING: "Chờ nhận",
  ACCEPTED: "Đã nhận lời mời",
  REVOKED: "Đã thu hồi",
  EXPIRED: "Đã hết hạn",
  PUBLISHED: "Đã xuất bản",
  READY: "Sẵn sàng",
  UPLOADING: "Đang tải lên",
  FAILED: "Tải lên thất bại",
  DELETED: "Đã xóa",
  CONNECTED: "Đã kết nối",
  DISCONNECTED: "Đã ngắt kết nối",
  NEED_RECONNECT: "Cần kết nối lại",
  NOT_STARTED: "Chưa bắt đầu",
  OPENED: "Đã mở",
  PARENT_CONFIRMED: "Gia đình đã xác nhận",
  SUBMITTED: "Chờ cô duyệt",
  NEEDS_REVISION: "Cần bổ sung",
  CHANGES_REQUESTED: "Cần bổ sung",
  SCHEDULED: "Theo lịch",
  CANCELLED: "Đã hủy",
  PAUSED: "Đã tạm dừng",
  UNMARKED: "Chưa đánh dấu",
  PRESENT: "Có mặt",
  LATE: "Đi muộn",
  ABSENT_EXCUSED: "Nghỉ có phép",
  ABSENT_UNEXCUSED: "Nghỉ chưa báo",
  CURRENT: "Đang áp dụng",
  UPCOMING: "Sắp áp dụng",
  ENDED: "Đã kết thúc",
};
export const submissionStatusLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Chờ cô duyệt",
  ACCEPTED: "Đã chấp nhận",
  CHANGES_REQUESTED: "Cần bổ sung",
};
export const classStatusLabels: Record<string, string> = {
  DRAFT: "Chuẩn bị",
  ACTIVE: "Đang dạy",
  COMPLETED: "Đã kết thúc",
  ARCHIVED: "Đã lưu trữ",
};
export function statusTone(status: string) {
  if (
    [
      "ACTIVE",
      "READY",
      "CONNECTED",
      "ACCEPTED",
      "COMPLETED",
      "PARENT_CONFIRMED",
      "PRESENT",
      "CURRENT",
      "ISSUED",
      "RECORDED",
      "PAID",
      "NO_PAYMENT_DUE",
    ].includes(status)
  )
    return "success";
  if (["PUBLISHED", "OPENED", "SCHEDULED", "UPCOMING"].includes(status))
    return "info";
  if (
    [
      "PENDING",
      "UPLOADING",
      "NEED_RECONNECT",
      "SUBMITTED",
      "NEEDS_REVISION",
      "CHANGES_REQUESTED",
      "LATE",
      "PARTIAL",
    ].includes(status)
  )
    return "warning";
  if (["FAILED", "REJECTED", "REVOKED", "ABSENT_UNEXCUSED"].includes(status))
    return "danger";
  return "neutral";
}
