# TinyClass — Kế hoạch triển khai

Ngày lập/cập nhật: 02/11/2026. TC-001–008 và TC-010/012/013/014 đã hoàn thành theo phạm vi từng task. Cấu hình Google thật tạm hoãn theo yêu cầu; TC-009 giữ phần mã/kiểm thử đã có. Xem [báo cáo học liệu](../verification/2026-11-02-learning.md), [spec](../spec/README.md) và [tổng quan](../01-mo-ta-he-thong.md).

| Tài liệu | Dùng để làm gì |
|---|---|
| [01-roadmap.md](01-roadmap.md) | Mốc triển khai, thứ tự, điều kiện vào/ra và trạng thái ban đầu |
| [02-backlog.md](02-backlog.md) | Công việc cụ thể có mã, phần phụ thuộc, đầu ra backend/frontend và tiêu chí xong |
| [03-validation-and-release.md](03-validation-and-release.md) | Kiểm thử phù hợp, ánh xạ 48 tình huống nghiệm thu và điều kiện phát hành |

## Cách dùng

1. Tiếp tục TC-015/016 nộp sản phẩm và phản hồi, rồi lịch/điểm danh/học phí theo phụ thuộc. TC-009 cấu hình thật đang tạm hoãn; kho LOCAL và luồng học liệu không cần Google. TC-011 Drive vẫn riêng, chưa triển khai adapter kết nối.
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
LearnManager/
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

