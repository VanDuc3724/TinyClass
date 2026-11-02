export const statusLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
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
    ].includes(status)
  )
    return "success";
  if (["PUBLISHED", "OPENED"].includes(status)) return "info";
  if (["PENDING", "UPLOADING", "NEED_RECONNECT"].includes(status))
    return "warning";
  if (["FAILED", "REJECTED", "REVOKED"].includes(status)) return "danger";
  return "neutral";
}
