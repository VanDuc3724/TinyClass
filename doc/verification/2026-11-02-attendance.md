# TC-018 — Kết quả kiểm tra điểm danh theo buổi

Ngày 02/11/2026 · Dữ liệu giả · Java 21 / Spring Boot 4.1.2 / PostgreSQL 17.11 / React / Edge headless.

Phạm vi: điểm danh theo buổi, snapshot danh sách/tên, sửa có lý do, ghi chú riêng/chia sẻ, hoàn thành/mở lại và lịch sử đúng bé. **Học bù tạm hoãn theo yêu cầu người dùng; không có API/bảng học bù trong V10.** [Hướng dẫn](../11-diem-danh.md), [plan](../plan/2026-11-02-attendance.md), [OpenAPI](../spec/openapi.yaml).

## Kết quả

| Kiểm tra | Kết quả |
|---|---|
| `Backend/mvnw.cmd -B verify` | **107 test đạt**, không lỗi/skip, tạo executable JAR |
| Kiểm tra tập trung `AttendanceTests,MigrationTests` | 15 test đạt; nằm trong bộ đầy đủ bên trên |
| `npm.cmd run build` | TypeScript và Vite production build thành công |
| `npm.cmd run lint` | oxlint không lỗi |
| `npm.cmd run test:e2e -- --trace=retain-on-failure` | **25 E2E đạt**, gồm ba luồng điểm danh mới, khoảng 3 phút |
| OpenAPI 0.0.9 | 106 path, 126 operation, 157 schema, 1.798 tham chiếu hợp lệ; operationId duy nhất |

Maven và E2E chạy tuần tự, dùng PostgreSQL/Mailpit test riêng. E2E tự build frontend rồi dùng Vite preview; API/backend thật, OIDC provider thử nghiệm. Chỉ tình huống mất kết nối cố ý được giả lập bằng HTTP 503 ở trình duyệt. Dữ liệu demo có buổi dài vài giây để kiểm tra điều kiện bắt đầu/kết thúc theo đồng hồ thật.

## Những hành vi đã kiểm tra

- Chốt roster một lần, giữ tên/enrollment, không tự thêm/xóa khi thành viên lớp thay đổi. Hai lần chốt đồng thời không nhân đôi; danh sách rỗng vẫn là snapshot hợp lệ. Điều chỉnh thêm/loại/khôi phục có lý do và không xóa lịch sử.
- Năm trạng thái tách biệt; UNMARKED không phải nghỉ. Chặn có mặt/đi muộn trước giờ, cho phép báo nghỉ sớm. Đánh dấu nhanh giữ lựa chọn báo nghỉ đã nhập.
- Kiểm tra mọi ID/version/duplicate trước khi cập nhật batch; lỗi không ghi một phần. Hai lượt lưu cùng phiên bản chỉ một lượt thành công. UI giữ chữ/trạng thái/lý do khi 503 hoặc 409 và xác nhận trước khi bỏ bản nhập để tải lại.
- Hoàn thành chỉ sau giờ kết thúc, có roster và không còn dòng hoạt động UNMARKED; roster rỗng cần lý do. Sửa kết quả cũ có lý do, đặt lại UNMARKED/bổ sung UNMARKED mở lại buổi; audit giữ lần hoàn thành trước.
- Buổi hủy/lớp lưu trữ chỉ đọc, kết quả cũ còn để đối chiếu; số hiệu lực của buổi hủy bằng không. Giới hạn ngày/phân trang/sĩ số, CSRF, vai trò và tài nguyên khác giáo viên được kiểm tra qua HTTP.
- Gia đình xem đúng con, chỉ ghi chú chia sẻ; response không có ghi chú/lý do riêng, enrollment, student ID hoặc version. Giữ lịch sử khi rời lớp/lưu trữ; đổi bé bỏ dữ liệu cũ; thu hồi liên kết chặn kết quả và lịch sử ở yêu cầu tiếp theo.
- Dashboard đếm DISTINCT bé PRESENT/LATE từ dòng hoạt động, theo lớp/ngày Việt Nam; giữ buổi COMPLETED, bỏ CANCELLED. Nâng V9 có dữ liệu lên V10 giữ nguyên lịch, phiên bản và ngoại lệ đã có.
- Màn hình mới được kiểm tra desktop 1440px, mobile 375px và gia đình 320px, không tràn ngang. Các luồng UI cũ tiếp tục kiểm tra sáu breakpoint, focus/drawer, học liệu/sản phẩm/lịch và timezone khác.

Kiểm thử phát hiện và đã sửa phần hồ sơ bé bị dãy nút điều hướng làm co tên ở desktop: các lối vào chức năng nay nằm trên một hàng riêng có xuống dòng. QA ảnh cũng phát hiện lựa chọn lớp bị trả về “Tất cả lớp” khi thay tùy chọn tạm bằng dữ liệu vừa tải; đã giữ đúng giá trị lớp/bé theo URL, có assertion trên bộ lọc lớp. Một lần chạy dev server gặp `ERR_NO_BUFFER_SPACE` khi Edge tải React Refresh, dẫn tới thiếu preamble; bộ E2E đã chuyển sang kiểm tra bundle production qua preview, giảm lượng module cần tải. Bộ cuối chạy đủ 25 luồng, không bỏ qua tình huống thất bại.

## Ảnh minh chứng

Ảnh từ dữ liệu giả trong lần chạy 25 luồng đạt; đã xem lại bố cục, chữ và vị trí thanh gia đình.

| Màn hình | Ảnh |
|---|---|
| Danh sách đã lưu, ba trạng thái thực tế ở desktop | [1440px](assets/2026-11-02-attendance-teacher-saved-1440.png) |
| Buổi đã hoàn thành, điều chỉnh đi muộn | [375px](assets/2026-11-02-attendance-teacher-completed-375.png) |
| Lịch sử giáo viên và lý do riêng | [375px](assets/2026-11-02-attendance-teacher-history-375.png) |
| Xung đột phiên bản giữ ghi chú đang nhập | [375px](assets/2026-11-02-attendance-teacher-conflict-375.png) |
| Tra cứu theo lớp/ngày | [375px](assets/2026-11-02-attendance-teacher-list-375.png) |
| Buổi hủy giữ dữ liệu và khóa sửa | [1440px](assets/2026-11-02-attendance-teacher-cancelled-1440.png) |
| Kết quả riêng của bé và lời nhắn chia sẻ | [375px](assets/2026-11-02-attendance-family-result-375.png) |
| Lịch sử gia đình không có lý do riêng | [375px](assets/2026-11-02-attendance-family-history-375.png) |
| Buổi hủy vẫn đối chiếu được lịch sử | [320px](assets/2026-11-02-attendance-family-cancelled-320.png) |
| Sau thu hồi, nội dung cũ được bỏ | [320px](assets/2026-11-02-attendance-family-revoked-320.png) |

## Giới hạn

Snapshot lấy thành viên đủ điều kiện lúc chốt; không tái dựng đầy đủ lịch sử lớp quá khứ. Tối đa 500 bé/buổi và 93 ngày/lượt tra cứu. Ghi chú điểm danh không thay module nhận xét định kỳ. Chưa có học bù, tính học phí hay tự gửi thông báo từ điểm danh. Google thật, Drive, email nhà cung cấp thật, kiểm tra tải/vận hành/backup tiếp tục theo các task tương ứng; báo cáo này không xác nhận toàn bộ sản phẩm đã sẵn sàng phát hành.
