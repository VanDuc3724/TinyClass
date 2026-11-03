# TC-019 — Kết quả kiểm tra nhận xét và hành trình bé

Ngày 02/11/2026 · Dữ liệu giả · Java 21 / Spring Boot 4.1.2 / PostgreSQL 17.11 / React / Edge headless.

Phạm vi: nhận xét riêng/chia sẻ, ngày/lớp/buổi hợp lệ, tệp gắn theo nhận xét, audit trước/sau, lưu trữ/khôi phục và dòng thời gian chung sản phẩm đã gửi. [Hướng dẫn](../12-nhan-xet-va-tien-bo.md), [plan](../plan/2026-11-02-student-notes.md), [OpenAPI](../spec/openapi.yaml). Google thật/học bù tiếp tục tạm hoãn; phí và thông báo chưa thuộc mốc này.

## Kết quả

| Kiểm tra | Kết quả |
|---|---|
| `Backend/mvnw.cmd -B verify` | **120 test đạt**, không lỗi/skip, có executable JAR |
| `StudentNoteTests,MigrationTests` | 18 test tập trung đạt; nằm trong bộ đầy đủ trên |
| `npm.cmd run build` | TypeScript/Vite production build thành công; trang hành trình tách thành chunk tải khi mở |
| `npm.cmd run lint` | oxlint đạt |
| `npm.cmd run test:e2e -- --trace=retain-on-failure` | **28 E2E đạt**, gồm ba luồng nhận xét mới; khoảng 3 phút |
| OpenAPI 0.0.10 | 120 path, 142 operation, 184 schema, 1.940 tham chiếu hợp lệ; operationId duy nhất |

Maven/E2E chạy tuần tự với PostgreSQL/Mailpit test riêng. E2E dùng bundle production qua preview, API/database thật và OIDC provider thử nghiệm. Chỉ các lỗi upload/lưu chủ động kiểm tra được giả lập ở trình duyệt. Một tình huống cho backend lưu thành công rồi trả 503 thay phản hồi để kiểm tra retry tạo mới không nhân đôi. File ảnh thật dùng asset PNG 343 × 361 của frontend để kiểm tra xem trước trong form mobile; không có ảnh trẻ thật.

## Hành vi đã xác nhận

- Mặc định PRIVATE; chỉ SHARED chưa lưu trữ vào family list, detail, counts và timeline. Không có private body/file ID/count, version, mã yêu cầu/hash, audit hay lý do riêng trong projection gia đình. Không có endpoint history cho gia đình.
- Body/ngày/phạm vi/ngữ cảnh/tệp được kiểm tra trước khi ghi nguyên tử. Ngày không tương lai; lớp thuộc đúng quan hệ bé; buổi đã bắt đầu/cùng ngày/đúng lớp và membership hoặc roster phù hợp. Tệp cần READY/NOTE_ASSET/đúng cô, riêng biệt và đúng giới hạn.
- Tệp gắn cố định với một note; không tái dùng sang note/bé khác kể cả sau gỡ/lưu trữ. Content/download kiểm tra current attachment/binding/visibility/guardian mỗi lần, có Range 206, private/no-store. Không có URL kho chung cho gia đình.
- Chuyển SHARED → PRIVATE, lưu trữ, gỡ tệp hoặc thu hồi guardian chặn đường dẫn cũ ở yêu cầu tiếp theo. Chuyển lại SHARED chỉ trả phiên bản hiện tại; private snapshot cũ nằm trong audit giáo viên. Khôi phục SHARED chia sẻ lại rõ ràng.
- Phiên bản/lý do được kiểm tra; hai lượt sửa đồng thời chỉ một lượt thành công. Hai lần tạo cùng request/payload giữ một note và một audit tạo. Payload thay đổi với cùng mã bị từ chối. Tệp sai/ngoài chủ sở hữu, trùng ID hoặc version cũ không làm ghi một phần hoặc gắn nhầm tệp.
- UI giữ chữ/tệp đã tải và lý do khi upload/lưu 503 hoặc 409. Lỗi chung được cuộn vào vùng nhìn và nhận focus; lỗi trường giữ cơ chế focus hiện có. Tải lại bản mới hỏi trước khi bỏ bản nhập. Xem trước ảnh thật vừa chiều ngang form 375px.
- Dòng thời gian có note và sản phẩm đã gửi, không DRAFT; phân trang/lọc loại theo dữ liệu đã lọc quyền, sắp xếp ổn định. Tổng số là ghi nhận chia sẻ và từng lượt gửi/duyệt; không tự chấm phát triển hoặc thay tiến độ bài học.
- SHARED/product history còn xem được sau rời lớp/lưu trữ hồ sơ khi guardian hiệu lực. Thu hồi chặn cả notes/progress/files; UI bỏ nội dung nhận xét/sản phẩm cũ khi nhận lỗi quyền. Đổi bé giữ route hành trình và bỏ dữ liệu của bé trước.
- Nâng V10 có dữ liệu lên V11 giữ nguyên version/note riêng của attendance và version buổi/roster cũ. Quy tắc một giáo viên của TinyClass được giữ. Các luồng cũ tiếp tục đạt.

## Ảnh minh chứng

Ảnh từ lần chạy đạt 28 luồng, đã xem lại bố cục, phạm vi riêng/chia sẻ, modal và thanh gia đình. Các đường dẫn dưới đây được lưu ngoài thư mục kết quả test tạm.

| Màn hình | Ảnh |
|---|---|
| Hành trình cô có note riêng, chia sẻ và sản phẩm | [1440px](assets/2026-11-02-student-notes-teacher-timeline-1440.png), [375px](assets/2026-11-02-student-notes-teacher-timeline-375.png) |
| Form mặc định riêng và giữ chữ/tệp | [375px](assets/2026-11-02-student-notes-teacher-editor-375.png) |
| Xem trước ảnh thật vừa form | [375px](assets/2026-11-02-student-notes-teacher-file-preview-375.png) |
| Bản sửa được giữ khi xung đột | [375px](assets/2026-11-02-student-notes-teacher-conflict-375.png) |
| Audit trước/sau, phiên bản riêng chỉ cô | [1440px](assets/2026-11-02-student-notes-teacher-history-1440.png) |
| Nhận xét lưu trữ và thao tác khôi phục | [375px](assets/2026-11-02-student-notes-teacher-archived-375.png) |
| Gia đình có shared note/tệp và sản phẩm | [375px](assets/2026-11-02-student-notes-family-timeline-375.png) |
| Đổi sang bé không có ghi nhận | [320px](assets/2026-11-02-student-notes-family-other-child-320.png) |
| Thu hồi liên kết, nội dung cũ được bỏ | [320px](assets/2026-11-02-student-notes-family-revoked-320.png) |

## Giới hạn

Đây là ghi nhận thủ công, chưa có mẫu đánh giá theo độ tuổi, báo cáo PDF, tổng kết tự động hay chấm phát triển. Mỗi note tối đa 5 tệp/250 MB và giới hạn từng loại theo kho hiện có; upload chưa gắn vẫn tính quota, chưa có dọn tự động. Bản gia đình đã tải về trước khi thu hồi là bản sao đã nhận. Quy tắc membership hiện có không tái dựng đầy đủ mọi giai đoạn chuyển lớp trong quá khứ. Drive, học phí/thông báo, Google/email nhà cung cấp thật, tải thử/backup/vận hành thật tiếp tục theo task riêng; không coi toàn bộ sản phẩm đã nghiệm thu phát hành.
