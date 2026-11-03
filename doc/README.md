# TinyClass — Tài liệu dự án

| Bộ tài liệu | Mục đích |
|---|---|
| [Mô tả hệ thống](01-mo-ta-he-thong.md) | Tổng quan trao đổi, yêu cầu đã chốt, schema và danh mục API/AC gốc |
| [Spec theo module](spec/README.md) | Mô tả hành vi, dữ liệu/API liên quan, màn hình và nghiệm thu của từng nhóm |
| [Plan triển khai](plan/README.md) | Lộ trình, 28 công việc có phụ thuộc, kiểm tra và điều kiện bàn giao |
| [Cấu hình Google](07-google-login-local.md) | OAuth client/callback, đăng nhập, liên kết và thử tài khoản thật |
| [Học liệu LOCAL](08-hoc-lieu-local.md) | Tải tệp, soạn bài/khóa, giao cho lớp/bé và xác nhận tiến độ |
| [Sản phẩm và phản hồi](09-san-pham-va-phan-hoi.md) | Lưu nháp/gửi sản phẩm, phản hồi chữ/âm thanh, mở vòng mới và lịch sử riêng của bé |
| [Cấu hình học phí](13-cau-hinh-hoc-phi.md) | Mặc định lớp, điều kiện từng bé, ngày hiệu lực/thay mức/kết thúc/hủy và quyền gia đình |
| [Tổng quan và trải nghiệm](17-tong-quan-va-trai-nghiem.md) | Số liệu lớp/bé, tiến độ/tiếp tục, lịch, khoản phải thu và cập nhật theo quyền nguồn |
| [Thông báo và cập nhật](16-thong-bao-va-cap-nhat.md) | Bảng tin theo lớp, dấu đọc theo bản công bố, chuông và hộp cập nhật theo quyền nguồn |
| [Ghi nhận thanh toán](15-thanh-toan.md) | Thu từng phần/đủ, hủy khoản nhập sai, tổng đã thu/còn lại và lịch sử đúng bé |
| [Phiếu học phí](14-phieu-hoc-phi.md) | Xem trước, nháp/phát hành/hủy, giữ buổi chống trùng, lịch sử và gia đình đọc phiếu |
| [Nhận xét và hành trình](12-nhan-xet-va-tien-bo.md) | Nội dung riêng/chia sẻ, tệp, lịch sử, lưu trữ/khôi phục và dòng thời gian sản phẩm |
| [Điểm danh](11-diem-danh.md) | Danh sách theo buổi, năm trạng thái, ghi chú riêng/chia sẻ, hoàn thành và lịch sử của bé |
| [Lịch dạy](10-lich-day.md) | Lịch tuần, xem trước/sinh buổi, trùng giờ, đổi/hủy, lịch sử và lịch gia đình |

Đọc spec để hiểu hệ thống phải làm gì, plan để chọn công việc và xác định khi nào hoàn thành. Những đề xuất chưa duyệt nằm ở [sổ quyết định](spec/06-decisions.md); thông tin đã xác nhận và dữ kiện đã quan sát được ghi tách biệt.

TC-001–008 và TC-010/012/013/014/015/016/017/018/019/020/021/022/023/024/025 đã hoàn thành theo phạm vi từng task. Google thật và học bù tạm hoãn theo người dùng; luồng LOCAL không cần Google. Xem [hướng dẫn chạy local](../README.md), [OpenAPI](spec/openapi.yaml), [tổng quan](17-tong-quan-va-trai-nghiem.md) và [báo cáo mới nhất](verification/2026-11-03-dashboard.md). TC-025 đã hoàn tất; các bước G4 cần chốt phạm vi phát hành và các tích hợp còn thiếu. Drive và vận hành thật theo backlog.

