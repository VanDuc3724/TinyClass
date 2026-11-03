# TinyClass — Kế hoạch triển khai

Ngày lập/cập nhật: 03/11/2026. TC-001–008 và TC-010/012/013/014/015/016/017/018/019/020/021/022/023/024/025 đã hoàn thành theo phạm vi từng task. Cấu hình Google thật tạm hoãn theo yêu cầu; TC-009 giữ phần mã/kiểm thử đã có. Xem [báo cáo tổng quan](../verification/2026-11-03-dashboard.md), [spec](../spec/README.md) và [tổng quan](../01-mo-ta-he-thong.md).

| Tài liệu | Dùng để làm gì |
|---|---|
| [01-roadmap.md](01-roadmap.md) | Mốc triển khai, thứ tự, điều kiện vào/ra và trạng thái ban đầu |
| [02-backlog.md](02-backlog.md) | Công việc cụ thể có mã, phần phụ thuộc, đầu ra backend/frontend và tiêu chí xong |
| [03-validation-and-release.md](03-validation-and-release.md) | Kiểm thử phù hợp, ánh xạ 48 tình huống nghiệm thu và điều kiện phát hành |
| [2026-11-02-submissions.md](2026-11-02-submissions.md) | Phạm vi và quyết định triển khai TC-015/016 đã hoàn thành |
| [2026-11-02-schedule.md](2026-11-02-schedule.md) | Phạm vi và quyết định triển khai TC-017 lịch dạy |
| [2026-11-02-attendance.md](2026-11-02-attendance.md) | Phạm vi điểm danh TC-018; học bù tạm hoãn |
| [2026-11-02-student-notes.md](2026-11-02-student-notes.md) | Phạm vi nhận xét và hành trình TC-019 |
| [2026-11-02-tuition-settings.md](2026-11-02-tuition-settings.md) | Chính sách lớp, thỏa thuận riêng/ngày hiệu lực và quyền gia đình TC-020 |
| [2026-11-02-invoices.md](2026-11-02-invoices.md) | Preview/phiếu/giữ buổi, snapshot và quyền gia đình TC-021 |
| [2026-11-02-payments.md](2026-11-02-payments.md) | Ghi thu/void, tổng tiền, chống lặp/thu vượt và lịch sử TC-022/023 |
| [2026-11-03-notifications.md](2026-11-03-notifications.md) | Bảng tin lớp, read revision, cập nhật theo nguồn/dedupe và giao diện TC-024 |
| [2026-11-03-dashboard.md](2026-11-03-dashboard.md) | Tổng quan cô/gia đình, khoản phải thu, tổng chính xác và trải nghiệm TC-025 |

## Cách dùng

1. TC-017 lịch, TC-018 điểm danh, TC-019 nhận xét/hành trình, TC-020 điều kiện, TC-021 phiếu, TC-022/023 ghi thu/void, TC-024 thông báo và TC-025 tổng quan đã DONE. Google thật và học bù tạm hoãn; kho LOCAL không cần Google. TC-011 Drive vẫn riêng, chưa triển khai adapter kết nối. G4 cần chốt phạm vi và các phụ thuộc còn thiếu; không tự đánh dấu TC-026 READY.
2. Đọc spec liên quan và những quyết định cần chốt cho task; tiếp tục phần độc lập nếu một cấu hình ngoài chưa có.
3. Khi thực hiện, cập nhật trạng thái, quyết định áp dụng và bằng chứng kiểm tra ngay tại task hoặc báo cáo được liên kết từ task.
4. Hoàn thành từng luồng frontend–API–database rồi mới đánh dấu DONE, theo phạm vi cụ thể của task.

## Quy ước trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| TODO | Đã mô tả, chưa đủ điều kiện hoặc chưa bắt đầu |
| READY | Đủ điều kiện để bắt đầu trong phạm vi đã xác định |
| IN_PROGRESS | Đang thực hiện, có ghi phần còn lại |
| BLOCKED | Công việc đang dừng vì phụ thuộc/cấu hình cụ thể, ghi rõ nguyên nhân và điều kiện tiếp tục |
| DONE | Đầu ra và kiểm tra của task đã đạt, có bằng chứng |

Mã `TC-*` là công việc, `AC-*` là tình huống nghiệm thu của tài liệu gốc, `Q-*` là quyết định trong [sổ quyết định](../spec/06-decisions.md). Hoàn thành việc viết tài liệu không tự đánh dấu các công việc tính năng là DONE.

## Cấu trúc repository đang dùng

```text
TinyClass/
  Backend/                     Spring Boot hiện có
  frontend/                    React hiện có
  doc/
    01-mo-ta-he-thong.md
    spec/
      README.md
      01-product.md
      02-auth-and-classes.md
      03-content-and-learning.md
      04-teaching-and-billing.md
      05-data-api-and-quality.md
      06-decisions.md
    plan/
      README.md
      01-roadmap.md
      02-backlog.md
      03-validation-and-release.md
```

