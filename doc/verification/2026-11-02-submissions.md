# TinyClass — Nghiệm thu sản phẩm và phản hồi

Ngày: 02/11/2026. Phạm vi [TC-015/016](../plan/2026-11-02-submissions.md), theo [spec học tập](../spec/03-content-and-learning.md) và [Design.md](../../frontend/Design.md). [Hướng dẫn sử dụng](../09-san-pham-va-phan-hoi.md).

## Kết quả triển khai

- V8 có `submissions`, `submission_attachments`, `submission_events` và vòng duyệt của tiến độ. Partial unique index chặn hai lượt SUBMITTED của cùng bé/item; nháp riêng theo tác giả/vòng. Khóa tiến độ cấp số lượt, submit/review/reopen nguyên tử với sự kiện/audit.
- Gia đình lưu nháp, upload, gửi, xem phản hồi và lịch sử; backend ràng buộc file READY đúng người upload/bé/item/loại trả lời, tối đa 5 file/250 MiB. Kho/quota của giáo viên tính cả tệp gia đình.
- Cô lọc hàng đợi, xem media, phản hồi chữ/âm thanh, chấp nhận hoặc yêu cầu bổ sung. Tiến độ TEACHER_REVIEW chỉ hoàn thành khi ACCEPTED. Cô mở vòng mới từ tiến độ từng người nhận; PARENT_CONFIRM cũng có thể được mở lại.
- Rời lớp giữ sản phẩm riêng nhưng chặn bài gốc/gửi mới; thu hồi guardian chặn cả lịch sử/tệp. Lớp kết thúc chỉ đọc với gia đình; cô có thể xử lý sản phẩm đã gửi.
- Dashboard dùng số sản phẩm chờ duyệt thật theo phạm vi lớp. Hook dữ liệu xóa nội dung cũ sau 401/403/404 và giữ dữ liệu khi lỗi kết nối/lỗi kho phù hợp.
- [OpenAPI 0.0.7](../spec/openapi.yaml): **90 path, 106 operation, 118 schema**; kiểm tra tham chiếu và operationId duy nhất.

## Kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Backend `mvnw.cmd -B verify` | 83 test đạt, 0 lỗi; JAR được tạo |
| Migration | Schema rỗng, nâng từ V1 và từ V7 có tiến độ hoàn thành: dữ liệu/mốc cũ được giữ, review cycle bắt đầu từ 0 |
| HTTP/nghiệp vụ | 10 test mới: nháp/version, gửi–bổ sung–gửi lại–chấp nhận, hai guardian đồng thời, file/loại/dung lượng, quyền/CSRF, rời lớp/thu hồi guardian/lớp kết thúc, mở vòng mới và âm thanh phản hồi |
| Frontend build/lint | Đạt, không cảnh báo lint |
| Playwright/Edge | 19/19 đạt: giữ 16 luồng cũ, thêm 3 luồng gia đình–giáo viên; có xác minh WAV nạp được duration trong trình duyệt |

Không chạy Maven và Playwright đồng thời vì cùng dùng database test. Các kịch bản nghiệp vụ reset riêng `tinyclass_test`; local-profile startup dùng database phát triển theo cấu hình kiểm tra hiện có. Không có dữ liệu demo được tự tạo trong database phát triển. OIDC/email tiếp tục dùng provider/SMTP local; chưa cấu hình Google thật.

## Đối chiếu nghiệm thu

| AC | Bằng chứng |
|---|---|
| AC-07 | Đổi child/item/submission/file hoặc tác giả: bị từ chối; người giám hộ khác không sửa nháp của tác giả |
| AC-16 | Rời lớp chặn bài/gửi mới; lịch sử sản phẩm giữ riêng. Guardian bị thu hồi mất cả lịch sử và file |
| AC-17/18 | Mở media không tự hoàn thành; xác nhận gia đình giữ luồng riêng, có thể được mở lại |
| AC-19 | Giữ lượt CHANGES_REQUESTED và phản hồi; lượt mới ACCEPTED mới hoàn thành |
| AC-20 | Hai request từ hai guardian đồng thời: một 200, một 409; database chỉ một SUBMITTED |
| AC-21 | Mở lại có lý do/sự kiện chứa trạng thái cũ; lượt accepted cũ không tự hoàn thành vòng mới |
| AC-22 | Item/tiến độ theo lần giao riêng; các kiểm thử học liệu cũ tiếp tục chạy |

## Giới hạn

LOCAL hiện là kho mặc định duy nhất được triển khai. Chưa Drive, thông báo nghiệp vụ, nhận xét định kỳ, lịch/điểm danh/học phí, dọn byte rời, quét malware hoặc chuyển mã media. PDF là học liệu, chưa là loại sản phẩm trả lời. Các giới hạn/quota là cấu hình kỹ thuật đã ghi trong spec, chưa nghiệm thu tải lớn hoặc hạ tầng production.

## Ảnh minh chứng

Các màn hình mới đã kiểm tra trên desktop và mobile 320/375px; bộ kiểm tra cũ tiếp tục kiểm tra sáu breakpoint. Nút lưu/gửi trên mobile xếp dọc để dễ thao tác. Phụ huynh xem âm thanh bằng điều khiển native, không tự phát. Tất cả tên/nội dung và âm thanh trong ảnh là dữ liệu kiểm thử giả.

- [Gia đình lưu nháp và tải sản phẩm — 375px](assets/2026-11-02-submissions-family-draft-375.png)
- [Hàng đợi và bộ lọc giáo viên — 375px](assets/2026-11-02-submissions-teacher-queue-375.png)
- [Giáo viên xem sản phẩm và nhập nhận xét — desktop](assets/2026-11-02-submissions-teacher-review-1440.png)
- [Sản phẩm được chấp nhận và phản hồi âm thanh — desktop](assets/2026-11-02-submissions-teacher-accepted-1440.png)
- [Gia đình nghe phản hồi — 320px, khung nhìn đã cuộn](assets/2026-11-02-submissions-family-feedback-320.png)
- [Lịch sử ba lượt trong hai vòng — 375px](assets/2026-11-02-submissions-family-history-375.png)
- [Refresh sau thu hồi liên kết bỏ nội dung cũ — 375px](assets/2026-11-02-submissions-access-revoked-375.png)
