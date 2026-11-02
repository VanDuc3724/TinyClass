# TinyClass — Sổ quyết định và những mục còn cần chốt

Ngày cập nhật: 02/11/2026. Nguồn xác nhận: trao đổi với người dùng và [các dòng XN-01 đến XN-18](../01-mo-ta-he-thong.md#s01). Dữ kiện code đọc từ `Backend/pom.xml`, lớp khởi động, `frontend/package.json` và cấu trúc workspace.

## 1. Yêu cầu đã xác nhận

- Tên chính thức TinyClass; một giáo viên cá nhân dạy trẻ mầm non tại nhà.
- Có nhiều lớp; giáo viên đăng bài/video/tài liệu theo chủ đề hoặc khóa học.
- React và Spring Boot ở các thư mục frontend/backend riêng.
- Phụ huynh có tài khoản liên kết hồ sơ bé; đăng nhập/đăng ký email/mật khẩu và Google.
- Upload trực tiếp, chọn máy chủ hoặc Drive cá nhân; giáo viên quyết định quyền tải học liệu.
- Bé rời lớp không còn quyền xem bài/khóa cấp từ lớp đó.
- Cần thiết kế cách tính/thu phí linh hoạt, có theo buổi và trọn khóa thu trước; chính sách cụ thể còn cần chốt.
- Viết tài liệu trước khi làm tính năng; bộ spec và plan được đặt trong `doc/spec/` và `doc/plan/`.

## 2. Những gì đã có trong repository

Frontend đã tạo React/TypeScript/Vite và có lockfile; lần kiểm tra trước đã build thành công. Backend đã tạo Spring Boot 4.1.2/Java 21/Maven và chọn các phụ thuộc Security/OIDC/JPA/PostgreSQL/Flyway/Mail/Validation/Web MVC. Đây là dữ kiện bộ khung, không phải xác nhận hệ thống nghiệp vụ đã được xây.

Backend verify đạt 72 test, frontend build/lint sạch và 16 E2E đạt. V1–V7 có LOCAL, chủ đề/bài/khóa, giao bài/recipient và gia đình xem/xác nhận ngoài tài khoản/lớp/email/Google đã có; dashboard tổng hợp dữ liệu thật theo lớp. Cấu hình Google thật tạm hoãn theo yêu cầu 02/11/2026; không ngăn luồng email/mật khẩu/LOCAL. Xem [báo cáo học liệu](../verification/2026-11-02-learning.md) và [giao diện](../verification/2026-11-02-design.md); báo cáo cũ giữ bằng chứng từng mốc.

Tên thư mục thực tế là `Backend/`, package `com.tinyclass`, artifact `backend`, service `tinyclass-backend`; frontend ở `frontend/` có tên package `tinyclass-frontend`. Giữ cấu trúc Git có sẵn trong đợt nền tảng: `.git` nằm trong Backend, chưa gộp Git gốc; việc thay tổ chức Git/hợp nhất lịch sử nếu cần là công việc riêng.

## 3. Quyết định còn mở

Giữ mã Q tương ứng tài liệu tổng quan để đối chiếu. Một task chỉ cần chốt những quyết định ảnh hưởng trực tiếp tới nó; việc chưa có cấu hình production không ngăn viết tài liệu hoặc làm phần độc lập.

| Mã | Nội dung | Phương án đang dùng để thiết kế | Cần chốt khi |
|---|---|---|---|
| Q-01 | Database và schema | PostgreSQL/JPA/Flyway local/test; V1–V7 từ schema rỗng/nâng cấp đạt; migration tiếp theo theo module | Trước migration nghiệp vụ mới |
| Q-02 | Session, đăng ký/liên kết | Session/CSRF/setup/PBKDF2, PARENT theo lời mời/email, OIDC issuer/subject, link/unlink và proof reauth 5 phút/một lần đã áp dụng; Google thật chưa nghiệm thu | Khi review chính sách/cấu hình Google thật; hai cách đăng nhập đã chốt |
| Q-03 | Runtime/build | Đã chuẩn hóa namespace, sửa wrapper và verify backend; frontend build/lint đạt. Giữ manifest/lockfile hiện có | Kiểm tra lại khi đổi runtime/phụ thuộc |
| Q-04 | Kho mặc định và quota | LOCAL đã triển khai với root riêng, quota kỹ thuật 5 GiB có thể cấu hình, giới hạn theo loại và mặc định tắt tải. Drive theo TC-011, chưa kết nối; không tự di chuyển/switch kho | Chốt dung lượng/ổ bền vững khi vận hành; OAuth Drive riêng khi thực hiện tích hợp |
| Q-05 | Quy mô/ngân sách | Dùng mốc tham chiếu ở spec chất lượng; cần số lớp/bé, dung lượng video và ngân sách thật | Trước load test/chọn hạ tầng vận hành |
| Q-06 | Chính sách học phí/nghỉ | Ba cách tính; thời điểm thu riêng; per-session mặc định nghỉ có phép không tính, chưa báo tính; quyền bù cấu hình; giáo viên duyệt phiếu | Trước tính phí; cần chốt mặc định lớp và cách quyết toán giữa đợt |
| Q-07 | Email/Google ứng dụng | SMTP/Mailpit riêng; xác minh 24 giờ, reset/SET_PASSWORD 30 phút, lời mời 48 giờ, cooldown email 60 giây. Google login mặc định tắt, bật cần Web OAuth client/callback theo hướng dẫn; tách Drive. Nhà cung cấp email thật/Google/Drive chưa nghiệm thu | Trước tích hợp thật; thêm mật khẩu Google-only đã có ở TC-009 |
| Q-08 | Kết thúc/lưu trữ | Rời lớp chặn bài đã chốt. Đề xuất lớp COMPLETED xem lại nhưng dừng nộp; giữ lịch sử riêng của bé và chốt thời hạn lưu | Trước vòng đời hoàn thành/lưu trữ và vận hành dữ liệu thật |
| Q-09 | Phạm vi phát hành | Đề xuất đầy đủ chức năng cơ bản theo spec sản phẩm, làm từng mốc; P2 làm sau | Trước cam kết phạm vi phát hành |
| Q-10 | Giao diện | Đã chuyển sang token tím, Nunito tiếng Việt tự phục vụ và CSS Modules theo [Design.md](../../frontend/Design.md); dashboard theo lớp, drawer tablet/mobile, menu tài khoản và thanh gia đình. Xem [bằng chứng](../verification/2026-11-02-design.md) | Dùng lại quy chuẩn khi làm các module tiếp theo |

## 4. Những đề xuất không tự trở thành xác nhận

- Cardinality nhiều bé/người giám hộ và một bé nhiều lớp là mô hình thiết kế hiện tại cần review khi chốt luồng gia đình.
- Lời mời 48 giờ, mật khẩu 12–128 ký tự, ngưỡng upload, RPO/RTO, quy mô tải thử và chính sách lớp COMPLETED là mặc định đề xuất.
- Mức tiền trong dữ liệu mẫu là ví dụ, không phải bảng giá kinh doanh.
- Cờ chỉ xem không phải chống mọi cách sao chép; thu hồi không thu lại bản đã tải hợp lệ.
- Thu tiền trước không cấp quyền vĩnh viễn; nghỉ giữa khóa và hoàn tiền thực tế là chính sách chưa tự động hóa.

## 5. Cách ghi quyết định mới

Ghi mã Q hoặc mã bổ sung, ngày, lựa chọn, người xác nhận, lý do và các file/task bị ảnh hưởng. Chuyển đúng trạng thái khi có xác nhận thực tế hoặc bằng chứng trong mã. Nếu chọn khác mặc định, sửa cả spec, API/schema và nghiệm thu liên quan trước triển khai phần bị ảnh hưởng; phần độc lập có thể tiếp tục.

