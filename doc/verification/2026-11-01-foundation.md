# TinyClass — Kết quả triển khai nền tảng

Ngày: 01/11/2026, múi giờ Asia/Ho_Chi_Minh. Phạm vi: TC-001 đến TC-004; chuẩn hóa nhãn frontend và chuẩn bị proxy của TC-005.

## Thay đổi đã thực hiện

- Sửa `mvnw.cmd` để không truy cập `Target[0]` khi thư mục Maven cache không phải liên kết.
- Backend chuyển sang package `com.tinyclass`, artifact `backend`, ứng dụng `tinyclass-backend`; frontend dùng tên package `tinyclass-frontend`, title TinyClass.
- Compose có PostgreSQL 17.11 cho local và test, bind loopback 55432/55433. Database local dùng volume; database test dùng tmpfs.
- Tạo `.env` riêng bằng script với mật khẩu ngẫu nhiên; thêm cấu hình local/test/production và gitignore cho dữ liệu local. Không lưu giá trị mật khẩu vào tài liệu.
- Flyway `V1__create_audit_events.sql`, Hibernate validate và audit JSONB đã kiểm tra với PostgreSQL.
- Thêm `ApiResponse`, `ApiError`, field errors, `PageResponse`, request ID, xử lý lỗi và lỗi security theo JSON.
- Có `GET /api/v1/health`, chỉ trả UP/DOWN dựa trên truy vấn database; các route nghiệp vụ hiện deny-by-default. Chưa có tài khoản giáo viên/phụ huynh thật trong mã ở mốc này.
- Có [OpenAPI](../spec/openapi.yaml) cho endpoint nền tảng và schema dùng chung; proxy Vite `/api` tới backend.

## Kết quả thực tế

| Kiểm tra | Kết quả |
|---|---|
| Maven Wrapper compile sau sửa | BUILD SUCCESS |
| `docker compose --profile test up -d --wait` | Hai container local/test Healthy |
| Build sạch và kiểm thử đầu tiên | `clean verify` thành công, 11 test đạt |
| `mvnw.cmd -B verify` sau bổ sung PageResponse/version contract | BUILD SUCCESS, 12 test, 0 failure, 0 error, 0 skipped |
| `npm.cmd run build` | Thành công |
| `npm.cmd run lint` | Thành công |

## Phân nhóm 12 test

| Lớp kiểm tra | Số test | Nội dung |
|---|---|---|
| `GlobalExceptionHandlerTests` | 5 | Validation/field errors, JSON lỗi, business conflict, version conflict, 500 không lộ chi tiết riêng |
| `LocalProfileStartupTests` | 1 | Startup profile local với database phát triển, gọi health qua HTTP thật |
| `TinyClassApplicationTests` | 6 | Database test/Flyway, audit JSONB round-trip, health/request ID, 401 JSON, CSRF 403 và thay request ID không hợp lệ |

Chi tiết do Maven sinh tại `Backend/target/surefire-reports/`; log lượt verify cuối ở `Backend/target/foundation-verification.log`. Đây là file build có thể được tạo lại, không phải dữ liệu đưa vào Git. Các test không thay thế nghiệm thu 48 AC nghiệp vụ của toàn sản phẩm.

## Trạng thái sau lượt làm

TC-001, TC-002, TC-003, TC-004 đã hoàn thành theo phạm vi nền tảng. TC-005 mới có nhãn/proxy; router, layout, API client và luồng UI vẫn cần triển khai. Tổ chức Git hiện có được giữ: Backend có repo riêng, chưa thực hiện gộp Git gốc.

Đăng nhập Google/email, lớp/trẻ, học liệu, quyền Drive và học phí chưa được coi là đã hoàn thành chỉ từ việc chọn dependencies. Những quyết định nghiệp vụ còn mở tiếp tục theo [sổ quyết định](../spec/06-decisions.md).

## Cách tái lập

Theo [README chạy local](../../README.md). Docker cần hoạt động; trước verify phải khởi động cả postgres và postgres-test. Chạy Maven từ `Backend/` để file `.env` được đọc đúng đường dẫn.
