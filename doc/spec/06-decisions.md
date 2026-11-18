# TinyClass — Sổ quyết định và những mục còn cần chốt

Ngày cập nhật: 04/11/2026. Nguồn xác nhận: trao đổi với người dùng và [các dòng XN-01 đến XN-20](../01-mo-ta-he-thong.md#s01). Dữ kiện code đọc từ `Backend/pom.xml`, lớp khởi động, `frontend/package.json` và cấu trúc workspace.

## 1. Yêu cầu đã xác nhận

- Tên chính thức TinyClass; một giáo viên cá nhân dạy trẻ mầm non tại nhà.
- Có nhiều lớp; giáo viên đăng bài/video/tài liệu theo chủ đề hoặc khóa học.
- React và Spring Boot ở các thư mục frontend/backend riêng.
- Phụ huynh có tài khoản liên kết hồ sơ bé; đăng nhập/đăng ký email/mật khẩu và Google.
- Upload trực tiếp, chọn máy chủ hoặc Drive cá nhân; giáo viên quyết định quyền tải học liệu.
- Bé rời lớp không còn quyền xem bài/khóa cấp từ lớp đó.
- Cần thiết kế cách tính/thu phí linh hoạt, có theo buổi và trọn khóa thu trước; chính sách cụ thể còn cần chốt.
- Viết tài liệu trước khi làm tính năng; bộ spec và plan được đặt trong `doc/spec/` và `doc/plan/`.
- Ngày 02/11/2026: tạm thời chưa cần quản lý học bù; TC-018 chỉ triển khai điểm danh. Khi xem lại học bù cần ưu tiên nhu cầu lịch cô có dạy, không mặc định theo kế hoạch bù từng bé.
- Ngày 04/11/2026: người dùng chọn tối ưu việc mở tệp sau khi được nêu đánh đổi quyền riêng tư. Response tệp chuyển từ `private, no-store` sang `private, no-cache` kèm ETag SHA-256: trình duyệt có thể giữ bản sao trên máy, nhưng mỗi lần mở vẫn kiểm tra phiên và quyền hiện tại, chỉ nhận 304 khi còn quyền. Đăng xuất gửi `Clear-Site-Data: "cache"` để xóa bản sao trên máy dùng chung (trình duyệt chỉ áp dụng trên HTTPS hoặc localhost). Ảnh hưởng: FileController, AuthController, [spec học liệu](03-content-and-learning.md), [OpenAPI](openapi.yaml) và test LocalStorage/StudentNote/AccountsAndClasses.
- Ngày 04/11/2026: người dùng chọn lưu nội dung tệp trong database thay cho thư mục trên ổ đĩa, bỏ quyết định cũ "không đưa byte vào cột BLOB". V19 thêm `file_chunks` (BYTEA khối 1 MiB, không nén lại vì media đã nén) cạnh metadata; kho vẫn là LOCAL "Máy chủ TinyClass", chỉ đổi nơi giữ byte. Byte và READY commit cùng giao dịch nên upload lỗi không để lại phần dở; Range chỉ đọc các khối cần. Một bản sao lưu PostgreSQL chứa đủ dữ liệu; đổi lại database lớn theo dung lượng tệp (quota 5 GiB) và sao lưu/khôi phục lâu hơn. Tệp cũ trong thư mục upload được nhập lúc khởi động khi khớp kích thước và SHA-256; thư mục chỉ được đọc. Ảnh hưởng: DatabaseStorageAdapter, LegacyUploadImporter, FileService, cấu hình `TINYCLASS_UPLOAD_ROOT`, [spec học liệu](03-content-and-learning.md), [mô tả hệ thống](../01-mo-ta-he-thong.md), [hướng dẫn LOCAL](../08-hoc-lieu-local.md) và test LocalStorage/Migration.
- Ngày 05/11/2026: người dùng chọn hiện điểm danh ngay trên lịch học của gia đình, bỏ trang "Điểm danh của bé". Lịch tuần xếp buổi theo cột ngày; thẻ buổi có trạng thái, lời nhắn của cô và lịch sử điểm danh. Q-08 vẫn giữ: kết quả của lớp bé đã rời hiện ở đúng ngày dù buổi không còn trong lịch; thu hồi liên kết chặn cả hai. API điểm danh gia đình không đổi; đường dẫn cũ chuyển về lịch. Đánh đổi: xem lịch sử dài phải chuyển từng tuần thay vì chọn khoảng 93 ngày. Trang tra cứu điểm danh của cô giữ nguyên. Ảnh hưởng: SchedulePages/ScheduleParts, menu gia đình, [hướng dẫn điểm danh](../11-diem-danh.md), [hướng dẫn lịch](../10-lich-day.md) và e2e attendance/schedule.
- Ngày 05/11/2026: người dùng chọn để cô bấm thẳng vào buổi trên lịch dạy là mở điểm danh, thay cho đi qua trang chi tiết buổi. Thẻ buổi trên lịch tuần và dashboard ghi "Chưa điểm danh" hoặc số bé đã đánh dấu trên danh sách buổi (chỉ tính bé còn trong danh sách); danh sách buổi của cô và `todaySessions` thêm `attendanceTotal`/`attendanceMarked`. Đổi, hủy và lịch sử buổi nằm sau nút **Chi tiết buổi học** trên trang điểm danh; buổi đã hủy vẫn mở trang chi tiết vì không còn gì để điểm danh. Đánh đổi: đổi giờ một buổi tương lai cần thêm một lần bấm.

- Ngày 18/11/2026, phản hồi tệp trở lại `private, no-store` để bảo vệ tệp riêng tư trên máy dùng chung cả khi đóng tab hoặc hết phiên. Backend kiểm tra phiên và quyền trước khi trả 304 cho yêu cầu có ETag. Đăng xuất hủy phiên và xóa cookie phiên. Bỏ header `Clear-Site-Data` để trình duyệt giữ cache của JS, CSS và font.

## 2. Những gì đã có trong repository

Frontend dùng React/TypeScript/Vite và có lockfile. Backend dùng Spring Boot 4.1.2/Java 21/Maven với Security/OIDC/JPA/PostgreSQL/Flyway/Mail/Validation/Web MVC; phạm vi nghiệp vụ đã kiểm tra được ghi bên dưới.

Backend có 200 test (LocalProfileStartupTests cần database phát triển đang chạy), frontend build/lint và 44 E2E đạt. V18 thêm index, V19 đưa byte tệp vào PostgreSQL; TC-025 thêm truy vấn tổng quan cô/gia đình theo quyền nguồn, tổng VND dạng chuỗi, tháng Việt Nam theo paidAt và tiến độ/tiếp tục đúng bé. Google thật/học bù tạm hoãn. Xem [báo cáo TC-025](../verification/2026-11-03-dashboard.md); các mốc cũ giữ bằng chứng riêng.

Tên thư mục thực tế là `Backend/`, package `com.tinyclass`, artifact `backend`, service `tinyclass-backend`; frontend ở `frontend/` có tên package `tinyclass-frontend`. Repository hiện có tại gốc `TinyClass/`; giữ nguyên cấu trúc và lịch sử của người dùng.

## 3. Quyết định còn mở

Giữ mã Q tương ứng tài liệu tổng quan để đối chiếu. Một task chỉ cần chốt những quyết định ảnh hưởng trực tiếp tới nó; việc chưa có cấu hình production không ngăn viết tài liệu hoặc làm phần độc lập.

| Mã | Nội dung | Phương án đang dùng để thiết kế | Cần chốt khi |
|---|---|---|---|
| Q-01 | Database và schema | PostgreSQL/JPA/Flyway local/test; V1–V19 schema rỗng và nâng V1/V7/V8/V9/V10/V11/V12/V15/V16/V18 có dữ liệu đạt. V17 giữ khoản thu/version/note, không gửi bù sự kiện trước nâng cấp; V18 chỉ thêm index sản phẩm theo bé; V19 thêm `file_chunks`, không chép byte trong migration (việc nhập tệp cũ chạy lúc khởi động) | Trước migration nghiệp vụ mới |
| Q-02 | Session, đăng ký/liên kết | Session/CSRF/setup/PBKDF2, PARENT theo lời mời/email, OIDC issuer/subject, link/unlink và proof reauth 5 phút/một lần đã áp dụng; Google thật chưa nghiệm thu | Khi review chính sách/cấu hình Google thật; hai cách đăng nhập đã chốt |
| Q-03 | Runtime/build | Đã chuẩn hóa namespace, sửa wrapper và verify backend; frontend build/lint đạt. Giữ manifest/lockfile hiện có | Kiểm tra lại khi đổi runtime/phụ thuộc |
| Q-04 | Kho mặc định và quota | LOCAL đã triển khai, byte nằm trong PostgreSQL (`file_chunks`, V19); quota kỹ thuật 5 GiB có thể cấu hình, tính cả tệp sản phẩm gia đình trong kho cô; giới hạn theo loại và mặc định tắt tải học liệu. Drive theo TC-011, chưa kết nối; không tự di chuyển/switch kho | Chốt dung lượng database và lịch sao lưu khi vận hành; OAuth Drive riêng khi thực hiện tích hợp |
| Q-05 | Quy mô/ngân sách | Dùng mốc tham chiếu ở spec chất lượng; cần số lớp/bé, dung lượng video và ngân sách thật | Trước load test/chọn hạ tầng vận hành |
| Q-06 | Chính sách học phí/nghỉ | TC-020–023: ba cách tính/nghỉ chọn rõ, snapshot/ngày/phiếu; thu từng phần/đủ, tiền/ngày/phương thức chọn rõ, void nhập sai có lý do/audit, không thu vượt/trùng hoặc hủy phiếu còn tiền. Phiếu 0 NO_PAYMENT_DUE; nháp/hủy không có số còn phải thu. Học bù tạm hoãn | Cô đối chiếu khoản thực nhận/quyết toán; hoàn tiền, ví/số buổi trả trước và cổng ngân hàng ngoài phạm vi hiện tại |
| Q-07 | Email/Google ứng dụng | SMTP/Mailpit riêng; xác minh 24 giờ, reset/SET_PASSWORD 30 phút, lời mời 48 giờ, cooldown email 60 giây. Google login mặc định tắt, bật cần Web OAuth client/callback theo hướng dẫn; tách Drive. Nhà cung cấp email thật/Google/Drive chưa nghiệm thu | Trước tích hợp thật; thêm mật khẩu Google-only đã có ở TC-009 |
| Q-08 | Kết thúc/lưu trữ | Rời lớp chặn bài/gửi mới; giữ lịch sử sản phẩm/phản hồi, điểm danh, nhận xét SHARED và học phí/ghi thu đúng bé khi guardian còn hiệu lực. Cô vẫn đối chiếu tiền trên invoice ISSUED; thu hồi chặn lịch sử/tệp và cập nhật bỏ nội dung cũ. Không tự thu/hoàn tiền hoặc cấp lại bài | Thời hạn lưu, quyết toán phần chưa học và chính sách vận hành dữ liệu thật cần chốt trước khi áp dụng |
| Q-09 | Phạm vi phát hành | Đề xuất đầy đủ chức năng cơ bản theo spec sản phẩm, làm từng mốc; P2 làm sau | Trước cam kết phạm vi phát hành |
| Q-10 | Giao diện | Đã chuyển sang token tím, Nunito tiếng Việt tự phục vụ và CSS Modules theo [Design.md](../../frontend/Design.md); dashboard theo lớp, drawer tablet/mobile, menu tài khoản và thanh gia đình. Xem [bằng chứng](../verification/2026-11-02-design.md) | Dùng lại quy chuẩn khi làm các module tiếp theo |
| Q-15 | Tổng quan/trải nghiệm | TC-025: ngày/tháng Việt Nam; khoản RECORDED theo paidAt, phiếu ISSUED còn tiền/quá hạn, tổng nhiều phiếu dùng chuỗi số nguyên/BigInt. Tổng quan REPEATABLE_READ; điều kiện quyền nguồn trước count/limit, preview 3 mục (phiếu 4), tiến độ chỉ bài bắt buộc đang được thực hiện, null khi chưa có việc để tiếp tục | Khi đổi chỉ số, quyền lịch sử, múi giờ hoặc phạm vi dữ liệu; tải thử vẫn thuộc G4 |
| Q-14 | Thông báo/cập nhật | TC-024: lớp/bé còn quyền mới xem bảng tin; read đúng revision, sửa cần đọc lại. Cập nhật theo nguồn hiện tại trước count/page/open, giữ lịch sử phí/sản phẩm khi còn guardian. Ghi BEFORE_COMMIT cùng transaction, unique dedupe, chỉ lưu ID; chuông cập nhật mỗi 60 giây khi hiển thị, khi focus/đổi trang gộp tối thiểu 15 giây, đọc cập nhật làm mới ngay | Khi mở thêm nguồn, gửi dịch vụ ngoài, WebSocket hoặc đổi chính sách lưu; email nghiệp vụ chưa bật |
| Q-13 | Nhận xét/hành trình | TC-019: ngày ghi nhận, PRIVATE mặc định, SHARED hiện tại cho guardian; file NOTE_ASSET gắn một note, audit chỉ cô, giữ shared history sau rời lớp. Counts là lượt ghi nhận/gửi/duyệt, không tự chấm phát triển | Khi đổi mẫu đánh giá, giới hạn tệp hoặc chính sách lưu |
| Q-12 | Điểm danh/học bù | TC-018 chỉ điểm danh theo buổi, giữ snapshot/lịch sử và ghi chú riêng/chia sẻ; học bù tạm hoãn ngày 02/11/2026. Không mặc định thiết kế bù theo từng bé | Khi người dùng mở lại phạm vi học bù |
| Q-11 | Lịch dạy | Đã áp dụng TC-017: giờ Việt Nam/UTC, khóa rule+tuần gốc, xem trước và xác nhận xung đột hiện tại; giữ ngoại lệ, lịch gia đình theo quyền lớp hiện tại. Giới hạn kỹ thuật/phạm vi tại [hướng dẫn](../10-lich-day.md), [bằng chứng](../verification/2026-11-02-schedule.md) | Khi mở phạm vi mới cần giữ khóa và bảo vệ roster; thay múi giờ/quy mô cần review riêng |

## 4. Những đề xuất không tự trở thành xác nhận

- Cardinality nhiều bé/người giám hộ và một bé nhiều lớp là mô hình thiết kế hiện tại cần review khi chốt luồng gia đình.
- Lời mời 48 giờ, mật khẩu 12–128 ký tự, ngưỡng upload, RPO/RTO, quy mô tải thử và chính sách lớp COMPLETED là mặc định đề xuất.
- Mức tiền trong dữ liệu mẫu là ví dụ, không phải bảng giá kinh doanh.
- Cờ chỉ xem không phải chống mọi cách sao chép; thu hồi không thu lại bản đã tải hợp lệ.
- Thu tiền trước không cấp quyền vĩnh viễn; nghỉ giữa khóa và hoàn tiền thực tế là chính sách chưa tự động hóa.

## 5. Cách ghi quyết định mới

**Q-16 — Góc chơi, 08/11/2026:** Người dùng duyệt triển khai CHOICE/MATCH/MEMORY cùng chức năng soạn/chơi thử/giao/xem kết quả. TC-029 dùng snapshot từng lần giao, server giữ lời giải và trạng thái lượt; UUID/hash/version chống lặp/ghi đè. Bộ sưu tập lấy best stars từng lần giao, không bảng xếp hạng. Lượt chơi riêng với yêu cầu hoàn thành bài cũ; guardian hiện tại quyết định quyền lịch sử. Giao qua lớp cần thành viên hiện tại, rời/quay lại không tự cấp lại; giao riêng cho bé độc lập với lớp. Thiết kế và giới hạn cụ thể tại [07-games.md](07-games.md).

Ghi mã Q hoặc mã bổ sung, ngày, lựa chọn, người xác nhận, lý do và các file/task bị ảnh hưởng. Chuyển đúng trạng thái khi có xác nhận thực tế hoặc bằng chứng trong mã. Nếu chọn khác mặc định, sửa cả spec, API/schema và nghiệm thu liên quan trước triển khai phần bị ảnh hưởng; phần độc lập có thể tiếp tục.

