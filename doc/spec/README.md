# TinyClass — Bộ đặc tả hệ thống

Ngày cập nhật: 03/11/2026. Bộ tài liệu mô tả sản phẩm mục tiêu; những phần đã code và kiểm tra được ghi riêng bên dưới, không coi toàn bộ đặc tả đã triển khai.

## Danh mục

| Tài liệu | Nội dung |
|---|---|
| [01-product.md](01-product.md) | Mục tiêu, phạm vi, vai trò, luồng và màn hình cốt lõi |
| [02-auth-and-classes.md](02-auth-and-classes.md) | Tài khoản, Google, lớp, hồ sơ trẻ và quan hệ gia đình |
| [03-content-and-learning.md](03-content-and-learning.md) | Học liệu, hai kho lưu, quyền tải, giao bài, sản phẩm và tiến độ |
| [04-teaching-and-billing.md](04-teaching-and-billing.md) | Lịch, điểm danh, học bù, nhận xét, học phí và thông báo |
| [05-data-api-and-quality.md](05-data-api-and-quality.md) | Quy ước dữ liệu, API, kiến trúc, chất lượng và dữ liệu kiểm thử |
| [06-decisions.md](06-decisions.md) | Những quyết định đã xác nhận, dữ kiện trong mã và mặc định còn cần chốt |

## Cách sử dụng

1. Đọc [tài liệu tổng quan](../01-mo-ta-he-thong.md), sau đó phạm vi sản phẩm và danh sách quyết định.
2. Khi triển khai một module, đọc spec tương ứng và chi tiết bảng/API ở mục 9–10 của tài liệu tổng quan.
3. Dùng [kế hoạch triển khai](../plan/README.md) để chọn công việc tiếp theo và đối chiếu tiêu chí hoàn thành.
4. Khi yêu cầu thay đổi, cập nhật quyết định, spec, kế hoạch và kịch bản nghiệm thu liên quan trong cùng lượt chỉnh sửa.

## Trạng thái thông tin

- **Đã xác nhận:** yêu cầu người dùng đã chọn, được ghi trong các dòng `XN-*` của tài liệu tổng quan.
- **Đã quan sát:** cấu trúc/phiên bản thực tế đọc từ repository, không đồng nghĩa tính năng đã hoạt động.
- **Đề xuất:** cách thiết kế hoặc chính sách mặc định cần review; kế hoạch không coi đây là quyết định đã được duyệt.
- **Chưa xác minh:** cần kiểm tra thực tế, ví dụ backend build hoặc phục hồi dữ liệu.

Chi tiết schema và API hiện có vẫn được tra tại [mô hình dữ liệu](../01-mo-ta-he-thong.md#s09) và [hợp đồng API](../01-mo-ta-he-thong.md#s10). Bộ spec này phân chia yêu cầu theo module, bổ sung cách đọc và tiêu chí triển khai, không tạo một bộ tên bảng/API khác. Những quyết định còn mở được quản lý tại [06-decisions.md](06-decisions.md).

## Trạng thái triển khai cập nhật

| Thành phần | Quan sát |
|---|---|
| `frontend/` | React/TypeScript/Vite, React Router 7; token tím/Nunito/CSS Modules theo Design.md, layout/guard/API client dùng API thật |
| `Backend/` | Có Spring Boot 4.1.2, Java 21, Maven, lớp khởi động và các starter đã chọn |
| Backend build | Wrapper verify đạt 196 test; executable JAR được tạo |
| Database/runtime | PostgreSQL local/test riêng; Flyway V1–V17, schema rỗng/nâng V1, V7, V8, V9, V10, V11, V12, V15 và V16 có dữ liệu đã kiểm tra |
| Tài khoản/lớp | Setup một giáo viên, session/CSRF, lớp/bé/thành viên/version/audit; quyền kiểm tra tại backend |
| Gia đình/email | Mời/đăng ký/xác minh/reset, liên kết nhiều bé/người giám hộ, DTO family riêng; SMTP Mailpit local/test |
| Google/phương thức | OIDC, đăng ký qua lời mời, link/unlink, reauth và thêm mật khẩu; provider có chữ ký thử nghiệm, chưa Google thật |
| Học liệu/giao bài | LOCAL/Range/quota, chủ đề/bài/khóa, snapshot/recipient, xem/xác nhận và nộp/duyệt sản phẩm theo vòng; chưa Drive |
| Lịch dạy/điểm danh | Lịch tuần/preview/sinh/đổi/hủy, snapshot/tên, năm trạng thái, sửa có lý do, hoàn thành/mở lại, lịch sử gia đình và dashboard thật; học bù tạm hoãn |
| Nhận xét/hành trình | V11 PRIVATE/SHARED, tệp theo nhận xét, ngữ cảnh lớp/buổi, lịch sử/lưu trữ/khôi phục và timeline sản phẩm; không tự chấm điểm |
| Điều kiện học phí | V12 mặc định lớp, snapshot riêng từng bé, ngày hiệu lực/thay/kết thúc/hủy, lịch sử riêng và trang gia đình; được bảo vệ khi có phiếu |
| Phiếu học phí | V13–V15 preview/nháp/sửa/phát hành/hủy, giữ buổi chống trùng, snapshot/audit và family invoice đúng bé |
| Ghi nhận thanh toán | V16 thu từng phần/đủ, ghi chú riêng/công khai, void có audit, version/idempotency/khóa chống thu vượt, chặn hủy phiếu còn khoản thu và lịch sử gia đình |
| Thông báo/cập nhật | V17 bảng tin nháp/đăng/sửa/lưu trữ, read revision, nguồn hiện còn quyền trước page/count/badge/open, dedupe và rollback; chuông và hộp cá nhân |
| Tổng quan | TC-025 lọc lớp/phiếu còn tiền/quá hạn/tháng Việt Nam, tổng nguyên dạng chuỗi; gia đình có tiến độ/tiếp tục/lịch/phí/phản hồi và cập nhật đúng bé, không migration mới |
| Kiểm tra giao diện | Build/lint sạch; 44 E2E Edge, các breakpoint hiện có, học liệu/sản phẩm/lịch/điểm danh/nhận xét, lỗi mạng/xung đột/quyền theo bé; [bằng chứng mới nhất](../verification/2026-11-03-dashboard.md) |
| Định danh | Backend com.tinyclass / backend / tinyclass-backend; frontend tinyclass-frontend và title TinyClass |
| Git | Repository hiện có tại gốc `TinyClass/`; giữ nguyên cấu trúc và lịch sử của người dùng |

Thư mục vật lý hiện tại là `Backend/` với chữ B hoa và `frontend/` chữ thường. Kế hoạch sử dụng đúng các đường dẫn đang tồn tại; việc đổi tên module hoặc tổ chức Git được xem xét riêng, không phải kết quả đã thực hiện trong bước viết tài liệu.

Phạm vi mới nhất ở [tổng quan](../verification/2026-11-03-dashboard.md), cùng [thông báo và cập nhật](../verification/2026-11-03-notifications.md), cùng [cấu hình](../verification/2026-11-02-tuition-settings.md), [nhận xét](../verification/2026-11-02-student-notes.md), [điểm danh](../verification/2026-11-02-attendance.md), [lịch](../verification/2026-11-02-schedule.md) và các mốc cũ. [OpenAPI 0.0.15](openapi.yaml) mô tả API thực tế. Google thật/học bù tạm hoãn theo người dùng. Drive và email nhà cung cấp thật tiếp tục theo backlog.

