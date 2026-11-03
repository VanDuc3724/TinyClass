# TinyClass — Bằng chứng bảng tin và cập nhật TC-024

Ngày kiểm tra: **03/11/2026**. Phạm vi: bảng tin nháp/đăng/sửa/lưu trữ, đọc theo bản công bố, cập nhật cá nhân tự phát sinh và kiểm tra quyền nguồn hiện tại. [Hướng dẫn](../16-thong-bao-va-cap-nhat.md), [plan](../plan/2026-11-03-notifications.md), [OpenAPI](../spec/openapi.yaml).

## Kết quả

| Kiểm tra | Kết quả |
|---|---|
| `Backend/mvnw.cmd -B verify` | **184 test đạt**, không lỗi/skip; executable JAR tạo thành công |
| HTTP bảng tin/cập nhật | **15 CommunicationTests đạt** trong bộ đầy đủ; gồm quyền/trạng thái/revision/dedupe/rollback và nguồn bài/sản phẩm/lịch/phí |
| Migration | **10 test đạt**; V1–V17 từ schema rỗng và nâng V1/V7/V8/V9/V10/V11/V12/V15/V16 có dữ liệu |
| Production build | TypeScript/Vite đạt; trang bảng tin/hộp cập nhật tải riêng; main JS khoảng 435,9 kB |
| `npm.cmd run lint` | oxlint đạt, không cảnh báo |
| `npm.cmd run test:e2e` | **41 E2E Edge đạt**, gồm ba luồng bảng tin/cập nhật mới; 3,8 phút. `.last-run.json`: passed, không failedTests |
| OpenAPI 0.0.14 | **155 path, 184 operation, 260 schema, 2.310 tham chiếu** hợp lệ; operationId duy nhất |
| Tài liệu/mã nguồn | 48 tệp Markdown, 486 liên kết nội bộ hợp lệ; không thấy ba giá trị bí mật local trong 294 tệp nguồn đã rà |
| `git diff --check` | Đạt, không lỗi khoảng trắng |

Maven và E2E chạy tuần tự trên PostgreSQL/Mailpit test riêng, giữ database/volume phát triển. E2E dùng bundle production và API/database thật với tên/email/nội dung giả. Mất phản hồi lúc tạo nháp được mô phỏng sau khi backend đã lưu; lỗi sửa 503 được mô phỏng trước lưu. Xung đột được tạo bằng một request thật ở cửa sổ khác. Không gửi email/SMS nghiệp vụ hoặc thông báo ra tài khoản bên ngoài.

## Hành vi đã xác nhận

- Cô tạo được nháp ở lớp DRAFT/ACTIVE, đăng ở ACTIVE; bản nháp chỉ cô xem. Tạo retry cùng teacher/clientRequestId/nội dung chuẩn hóa trả cùng bản ghi, khác nội dung 409. Hai lần tạo đồng thời cùng mã chỉ có một nháp; publish lặp/đồng thời chỉ một lần công bố/cập nhật.
- Tiêu đề/nội dung/lý do có giới hạn và không rỗng; tiền tố owner/vai trò/CSRF/email/phân trang/filter được kiểm tra tại backend. Mã thông báo/lớp không thuộc quyền trả 404. Tìm tiêu đề là chuỗi thường, ký tự `%` không mở rộng tìm kiếm.
- Sửa cần version và lý do riêng; bản đã đăng tăng revision. Dấu đọc là user/announcement/revision, gửi lại cùng bản giữ readAt. Sửa bản đã đăng làm dấu cũ chưa đọc; xác nhận revision cũ trả 409, không tự đánh dấu bản gia đình chưa xem.
- Lưu trữ giữ nội dung/audit trước/sau/lý do riêng và không cho công bố lại. Gia đình mất list/count/detail/read; ID cập nhật cũ không mở/đọc được và không góp vào badge. Cô vẫn đối chiếu lịch sử bản lưu trữ.
- Gia đình chỉ xem PUBLISHED đúng bé, còn guardian và quyền lớp/hồ sơ phù hợp. DTO không có version quản trị, private reason/note, request/hash hoặc audit; public revision phục vụ xác nhận đã đọc. Rời lớp, lưu trữ bé/lớp hoặc thu hồi guardian chặn cả bảng tin và cập nhật từ nguồn này trước count/page.
- Giao bài phát cập nhật cho người giám hộ, gửi sản phẩm phát cho cô, phản hồi phát cho gia đình; tạo/hủy lịch phát từ source thật. Bài/lịch mất quyền sau rời lớp, phản hồi sản phẩm giữ quyền lịch sử khi còn guardian. Phát hành phiếu/ghi thu/void phát đúng loại, không lấy ghi chú/lý do riêng vào DTO; lịch sử phí còn sau rời lớp, thu hồi guardian chặn toàn bộ.
- Nguồn đăng ký BusinessChange trong giao dịch; listener BEFORE_COMMIT tạo dòng cập nhật, chưa thấy trước commit. Rollback bỏ cả nguồn và mục cập nhật; phát lại cùng sự kiện/phiên bản không nhân đôi. Dòng chỉ lưu loại/ID/ngữ cảnh, không body/phản hồi/tiền/lý do riêng hoặc token.
- Cùng một SQL predicate bảo vệ nội dung/tổng/badge/detail/read theo nguồn hiện tại, không đếm nguồn ẩn rồi lọc ở React. Mỗi người nhận chỉ đọc ID của mình; đọc lại giữ mốc đầu tiên. Đường dẫn được backend sinh lại sau POST read khi bấm mở; cập nhật không cấp quyền nguồn.
- UI giữ chữ qua mất phản hồi/503/409 và đưa lỗi về vùng nhìn thấy. Đóng/cập nhật xác nhận bỏ bản nhập, không tự ghi đè thay đổi ở cửa sổ khác. Gia đình đọc lại bản mới, đổi bé về đúng bảng tin; cập nhật sau archive/withdraw/revoke bỏ nội dung cũ.
- Chuông/menu/bộ lọc dùng được ở desktop/mobile 375/320px. Topbar đã điều chỉnh để chứa chuông và bộ chọn bé, xuống dòng khi cần; bài kiểm tra zoom 200%, drawer/focus/Escape và các breakpoint cũ tiếp tục đạt. Không tràn ngang trong các ảnh kiểm tra.
- Nâng V16 giữ khoản thu 500.000 VND, version 5, ghi chú riêng và invoice version 3; bảng tin/cập nhật ban đầu rỗng, không tạo lịch sử giả hoặc gửi bù. Các migration trước giữ nguyên.

## Ảnh minh chứng

12 ảnh từ lần chạy đạt 41 luồng. Đã rà bố cục desktop/mobile, form lỗi, hộp cập nhật, đọc bản mới và mất quyền. Sidebar dài cuộn được; modal dài cuộn trong vùng hộp thoại. Ảnh toàn trang gia đình giữ thanh điều hướng cố định tại vị trí viewport khi chụp.

| Màn hình | Ảnh |
|---|---|
| Soạn bản nháp chọn lớp/tiêu đề/nội dung | [375px](assets/2026-11-03-communications-editor-375.png) |
| Mất phản hồi sau lưu, còn bản nhập để gửi lại | [375px](assets/2026-11-03-communications-response-loss-375.png) |
| Bản công bố và thao tác quản lý của cô | [1440px](assets/2026-11-03-communications-teacher-published-desktop.png) |
| Hộp cập nhật có đúng bé/lớp và thao tác đọc/mở | [375px](assets/2026-11-03-communications-family-updates-375.png) |
| Gia đình đã đọc bản hiện tại | [375px](assets/2026-11-03-communications-family-read-375.png) |
| Sửa đồng thời, lỗi 409 giữ chữ và lý do | [375px](assets/2026-11-03-communications-stale-editor-375.png) |
| Xác nhận bản cũ bị từ chối, cần đọc bản mới | [375px](assets/2026-11-03-communications-family-stale-read-375.png) |
| Audit và lý do riêng chỉ cô xem | [1440px](assets/2026-11-03-communications-teacher-history-desktop.png) |
| Thông báo lưu trữ còn trong quản lý của cô | [1440px](assets/2026-11-03-communications-teacher-archived-desktop.png) |
| Gia đình cập nhật sau lưu trữ, bỏ nội dung cũ | [320px](assets/2026-11-03-communications-family-archived-320.png) |
| Rời lớp chặn đường dẫn bảng tin cũ | [320px](assets/2026-11-03-communications-family-withdrawn-320.png) |
| Thu hồi guardian chặn nội dung đã tải ở lần cập nhật | [320px](assets/2026-11-03-communications-family-revoked-320.png) |

## Giới hạn

Chuông tải lại theo điều hướng/focus/read và mỗi 60 giây khi cửa sổ hiển thị; chưa có WebSocket. Khi cần dữ liệu mới ngay, chọn cập nhật danh sách. Không có đọc tất cả, chat, HTML/tệp bảng tin, gửi email/SMS nghiệp vụ, dịch vụ push ngoài hoặc tự gửi bù sự kiện cũ.

TC-025 dashboard/hoàn thiện trải nghiệm đã đủ phụ thuộc để bắt đầu. Google thật, Drive và học bù tiếp tục theo phạm vi đã hoãn; SMTP ngoài, tải thử, thời hạn giữ dữ liệu và backup/vận hành thật chưa nghiệm thu. Các báo cáo cũ giữ bằng chứng đúng từng mốc.
