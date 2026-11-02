# TinyClass — Dữ liệu, API và yêu cầu chất lượng

Chi tiết bảng/cột, FK và enum: [từ điển dữ liệu gốc](../01-mo-ta-he-thong.md#s09). Route nghiệp vụ: [API gốc](../01-mo-ta-he-thong.md#s10). Tài liệu này quy định cách triển khai nhất quán giữa các module.

<a id="requirements"></a>
## 1. Kiến trúc và dữ kiện hiện tại

| Thành phần | Dữ kiện trong mã hiện có |
|---|---|
| Frontend | `frontend/`, React `^19.3.1`, TypeScript `~7.0.2`, Vite `^8.3.5`, npm lockfile |
| Công cụ kiểm tra frontend | `build`: TypeScript + Vite; `lint`: oxlint; `test:e2e`: Playwright/Edge |
| UI/điều hướng hiện có | React Router 7, CSS thuần, provider session/API client cùng origin |
| Backend | `Backend/`, Spring Boot 4.1.2, Java 21, Maven |
| Phụ thuộc backend | Web MVC, Security, OAuth2 Client, JPA, Validation, Mail, Flyway, PostgreSQL và Flyway PostgreSQL |
| Kho LOCAL/nhận dạng tệp | Resource/Range của Spring MVC; Tika Core 3.3.3 và kiểm tra EBML DocType cho WebM |
| Namespace hiện tại | `com.tinyclass`, đã chuẩn hóa cùng artifact `backend` và service `tinyclass-backend` |

Các phiên bản frontend trên là khai báo trong `package.json`, không phải cam kết mọi dependency đã được kiểm thử tương thích nghiệp vụ. Dùng lockfile và Maven Wrapper đã kiểm tra để tái lập build. Việc đổi thư viện/major version là một thay đổi riêng khi có nhu cầu.

React gọi REST API Spring Boot. Backend theo module nghiệp vụ, service quản lý quyền/giao dịch, repository truy vấn, DTO tách khỏi entity JPA. Đề xuất production cùng origin qua reverse proxy `/api`; local Vite proxy tới backend. Kết nối Google login và Drive là hai registration/luồng quyền riêng.

## 2. Danh mục dữ liệu theo module

| Nhóm | Các bảng logic |
|---|---|
| Tài khoản | `users`, `auth_identities`, `auth_tokens` |
| Lớp/gia đình | `students`, `classes`, `class_enrollments`, `student_guardians`, `guardian_invitations` |
| Học liệu | `topics`, `lessons`, `lesson_topics`, `lesson_blocks`, `courses`, `course_lessons` |
| Lưu trữ | `storage_connections`, `files` |
| Giao/học bài | `assignments`, `assignment_items`, `assignment_recipients`, `student_progress`, `submissions`, `submission_attachments` |
| Buổi dạy | `class_schedule_rules`, `class_sessions`, `attendance_records`, `makeup_plans`, `student_notes`, `student_note_attachments` |
| Học phí | `class_tuition_policies`, `enrollment_tuition_agreements`, `invoices`, `invoice_lines`, `session_charge_entries`, `payments` |
| Trao đổi/lịch sử | `class_announcements`, `announcement_reads`, `notifications`, `audit_events` |

### Quy ước chung

- UUID do server tạo; `snake_case` trong database, `camelCase` cho JSON.
- Bản ghi có thể sửa có timestamps/version; bảng nối bất biến và sự kiện theo định nghĩa riêng.
- Timestamps lưu UTC/trả ISO 8601; ngày sinh và kỳ phí là date; lịch tuần dùng time + timezone.
- VND lưu nguyên theo miền `0..1_000_000_000_000`, tính tổng ở backend; tiền không dùng số thực. Chi tiết kiểu `numeric(14,0)` theo tổng quan.
- Có FK và unique cho các quan hệ không được trùng; kiểm tra quan hệ cùng giáo viên/trẻ và các điều kiện liên bảng ở service/giao dịch.
- Dữ liệu đã có lịch sử dùng archive/revoke/cancel/void; không cascade xóa sản phẩm/phí khi đổi lớp hay khóa.
- Giá trị chưa có dòng tiến độ là NOT_STARTED; không phải lỗi dữ liệu và không loại bé đó khỏi thống kê.

### Thứ tự nhóm migration đề xuất

1. Identity/token và audit; cơ chế khởi tạo chủ hệ thống riêng dữ liệu demo.
2. Lớp/trẻ/quan hệ gia đình. FK media tùy chọn chưa thể tham chiếu thì bổ sung ở nhóm media.
3. Kho lưu/file; bổ sung FK ảnh lớp/trẻ. Context file trỏ tới assignment được bổ sung khi có schema assignment.
4. Chủ đề/bài/khóa và các bảng nối.
5. Lần giao, item, người nhận, tiến độ và sản phẩm; bổ sung FK context file còn lại.
6. Lịch, điểm danh, bù và nhận xét.
7. Thỏa thuận, phiếu, buổi tính phí và thanh toán.
8. Thông báo lớp/đã đọc/thông báo cá nhân.

V1 audit, V2 users/classes/students/class_enrollments và V3 guardian_invitations/student_guardians/auth_tokens đã triển khai, kiểm tra từ schema rỗng và nâng V1 đến V3. Các nhóm còn lại là đề xuất. Migration chỉ áp dụng một lần; Hibernate validate. UUID tạo phía server, timestamp UTC microsecond. FK media và auth_identities bổ sung cùng module tương ứng.

## 3. Hợp đồng API chung

Hợp đồng endpoint hiện có: [openapi.yaml](openapi.yaml), gồm tài khoản/lớp/gia đình/email/Google, LOCAL/file/policy/Range, chủ đề/bài/khóa, snapshot giao bài, family item/file/open/confirm. PUT lesson/course/assignment nhận đủ biểu mẫu/version; list dùng DTO tóm tắt riêng. Google thật tạm hoãn; Drive/sản phẩm/lịch/phí tiếp tục theo module. PATCH lớp/bé nhận đủ biểu mẫu/version; bỏ trường tùy chọn sẽ xóa giá trị.

| Nội dung | Quy ước |
|---|---|
| Prefix | `/api/v1` |
| Request/response | JSON UTF-8, ngoại trừ file stream/multipart và OAuth redirect |
| Thành công | `{ "data": ... }`; danh sách có `meta` |
| Phân trang | `page` từ 0, `size` mặc định 20/tối đa 100; sort theo allowlist |
| Sửa đồng thời | DTO gửi `version`; phiên cũ trả 409 VERSION_CONFLICT |
| ID/actor | Backend xác định actor, role, owner, reviewer; không tin các trường client tự gán |
| Chống gửi lặp | `clientRequestId` khi tạo lần giao/phiếu; Idempotency-Key cho ghi thanh toán |
| Quyền | 401 cho chưa có phiên; 403 cho thao tác/CSRF không hợp lệ; 404 cho tài nguyên không tồn tại hoặc ngoài quyền |

Ví dụ tạo lớp; các trường chưa đặt được để trống theo schema:

```json
{
  "name": "Lớp khám phá",
  "minAgeMonths": 48,
  "maxAgeMonths": 72,
  "capacity": 10
}
```

Response minh họa:

```json
{
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "name": "Lớp khám phá",
    "status": "DRAFT",
    "version": 0
  }
}
```

Lỗi xác minh dữ liệu:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dữ liệu chưa hợp lệ.",
  "fieldErrors": [
    { "field": "capacity", "message": "Sĩ số phải lớn hơn 0." }
  ],
  "traceId": "example-request-001"
}
```

Các lỗi khác gồm trạng thái không hợp lệ, quá sĩ số, chưa đến giờ mở, mất quyền, tệp chưa READY/quá dung lượng, lượt nộp đang chờ và ghi tiền vượt số còn lại. OpenAPI từng module phải mô tả rõ request/response, permission, error/status và cơ chế gửi lặp, không chỉ có danh sách endpoint.

## 4. Giao dịch và tính nhất quán

| Thao tác | Bất biến cần giữ |
|---|---|
| Nhận lời mời | Một lần tiêu thụ, đúng email/bé, không trùng liên kết |
| Tạo/liên kết identity | Không trùng Google subject; còn phương thức đăng nhập hợp lệ |
| Thêm bé | Không trùng lớp/bé, không vượt sĩ số |
| Xuất bản lần giao | Danh sách item, người nhận và trạng thái đồng bộ |
| Gửi/duyệt sản phẩm | Tối đa một lượt chờ; tiến độ và kết quả duyệt đồng bộ |
| Điểm danh/bù | Một bé/buổi, một kế hoạch bù còn hiệu lực và trạng thái đúng nguồn/đích |
| Lập phí theo buổi | Một buổi gốc tối đa một khoản giữ/tính còn hiệu lực |
| Ghi tiền | Chống retry, không vượt số còn lại khi đồng thời, giữ lịch sử void |

Kiểm thử những điều kiện này trên PostgreSQL theo phương án đang đề xuất, vì chúng phụ thuộc FK, unique có điều kiện, JSON và giao dịch. Không coi kiểm tra frontend là đủ bằng chứng.

## 5. Cấu hình và dữ liệu dùng cho phát triển

- Profile local/test/production; cấu hình database, URL frontend, session/cookie, giới hạn upload và đường dẫn root qua môi trường.
- Cấu hình Google login tách Drive; token Drive mã hóa, key nằm ngoài kho mã.
- Dùng adapter email local để thử xác minh/khôi phục trước khi có dịch vụ chạy thật; không đánh dấu gửi email thực tế thành công chỉ từ mock.
- Dữ liệu giả theo [bộ dữ liệu gốc](../01-mo-ta-he-thong.md#s12): một cô, ba bé, nhiều quan hệ gia đình/lớp, khóa có ba cách hoàn thành, hai kho và phiếu thu một phần.
- Mật khẩu, OAuth secrets/tokens, dữ liệu trẻ thật và file upload không đưa vào commit hoặc log.

## 6. Yêu cầu chất lượng và vận hành

Mốc tham chiếu đề xuất: 20 lớp, 300 bé, 600 tài khoản gia đình, 20 người hoạt động đồng thời; API danh sách thông thường p95 dưới 2 giây trên hạ tầng kiểm thử đã xác định, không tính upload/video. Các mốc này cần xác nhận theo quy mô thật, không phải số đã đo được.

Giao diện dùng được từ 360 px, có thao tác bàn phím/nhãn phù hợp, trạng thái rỗng/lỗi/loading/upload và không tự phát âm thanh. Không lộ ghi chú, trẻ khác, file/key/tổng số ngoài quyền.

Production cần HTTPS, kho LOCAL bền vững hoặc Drive còn kết nối, health/log tối thiểu, sao lưu cả database và media, khóa giải mã được bảo vệ và thử phục hồi. Mục tiêu sao lưu mỗi ngày/RPO 24 giờ/RTO một ngày làm việc là đề xuất cần chốt, không phải bảo đảm dịch vụ đã có.

<a id="acceptance"></a>
## 7. Điều kiện kỹ thuật hoàn thành module

- Build/lint frontend qua; backend compile và các kiểm tra phù hợp của module qua trong môi trường có phụ thuộc cần thiết.
- Migration chạy được trên database mới và nâng cấp từ mốc trước, không chỉ dùng schema có sẵn trên máy người viết.
- OpenAPI/DTO và UI thống nhất; frontend dùng API thật cho luồng nghiệm thu.
- Có kiểm tra tích hợp cho quyền/trạng thái/giao dịch liên quan và ghi rõ kết quả thực tế.
- Mục chưa kiểm tra hoặc lỗi do môi trường được ghi thành giới hạn, không đánh dấu pass.
- Tài liệu và task được cập nhật theo hành vi cuối cùng.

