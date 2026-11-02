# TinyClass — Tài khoản, phân quyền, lớp và học sinh

Nguồn chi tiết: [luồng hoạt động](../01-mo-ta-he-thong.md#s05), [dữ liệu](../01-mo-ta-he-thong.md#s09), [API](../01-mo-ta-he-thong.md#s10). Phương án session/lời mời chi tiết là đề xuất tại [Q-02 và Q-07](06-decisions.md).

Trạng thái: TC-005 đến TC-008 có UI/API cho giáo viên, lớp–bé–thành viên, lời mời/đăng ký phụ huynh, xác minh/reset và gia đình xem con. TC-009 đã có UI/API Google, liên kết/hủy, xác thực lại và thêm mật khẩu cho Google-only; kiểm tra protocol/E2E với OIDC provider thử nghiệm. Xem [báo cáo Google](../verification/2026-11-02-google.md), [cấu hình Google](../07-google-login-local.md) và [OpenAPI](openapi.yaml). Google thật và SMTP ngoài local/test chưa nghiệm thu.

<a id="requirements"></a>
## 1. Tài khoản và định danh

| Mã | Yêu cầu |
|---|---|
| AUTH-01 | Một tài khoản giáo viên khởi tạo riêng; đăng ký công khai không tạo giáo viên mới. |
| AUTH-02 | Có email/mật khẩu và Google. Đăng ký qua Google không bắt đặt mật khẩu nội bộ. |
| AUTH-03 | Nhận diện Google bằng issuer/subject đã xác minh; không tự ghép vào tài khoản có sẵn chỉ vì trùng email. |
| AUTH-04 | Liên kết Google vào tài khoản cũ sau khi chủ tài khoản đăng nhập/xác thực lại; giữ nguyên user ID và dữ liệu. |
| AUTH-05 | Vai trò và trạng thái hoạt động lấy từ database, không lấy từ tham số gửi từ trình duyệt. |
| AUTH-06 | Khôi phục mật khẩu nội bộ, thêm mật khẩu cho Google-only và hủy phương thức là ba luồng có điều kiện riêng; không hủy phương thức cuối cùng. |
| AUTH-07 | Google login chỉ xin quyền danh tính; kết nối Drive là luồng cấp quyền lưu trữ riêng của giáo viên. |

### Phương án kỹ thuật đề xuất

Session cookie HttpOnly, HTTPS/Secure ở production và CSRF cho thao tác thay đổi dữ liệu. Frontend gọi cùng origin qua `/api/v1`; local dùng Vite proxy. Callback OIDC kiểm tra state/nonce/issuer/audience/chữ ký/hạn và chỉ chuyển về URL nội bộ được cho phép. Account DISABLED không có quyền nghiệp vụ dù Google xác thực đúng.

OAuth context giữ ngắn hạn phía server; không gửi Google token/session ID qua URL hoặc local storage. Token email/lời mời lưu dạng băm, một lần, có hạn. Password hash nullable cho Google-only; tài khoản ACTIVE phải có ít nhất một phương thức đăng nhập hợp lệ.

## 2. Lời mời và gia đình

1. Giáo viên chọn bé và email người nhận; hệ thống tạo lời mời riêng.
2. Phụ huynh dùng tài khoản có sẵn hoặc đăng ký email/Google.
3. Nhận quyền khi email được xác minh theo chính sách ứng dụng, khớp lời mời và token còn hiệu lực.
4. Backend nhận lời mời và tạo liên kết trong giao dịch, chống cấp trùng khi gửi lặp.
5. Thu hồi liên kết với một bé không làm mất quyền với những bé khác.

Google xác minh email đáng tin cậy theo hướng dẫn đã dẫn trong tổng quan; email bên thứ ba cần xác minh bổ sung khi áp dụng. Mặc định lời mời 48 giờ là đề xuất có thể cấu hình. Thông tin bé không công bố trên màn hình xem trước lời mời trước khi nhận quyền.

## 3. Lớp và học sinh

| Mã | Yêu cầu |
|---|---|
| CLASS-01 | Tạo/sửa/tìm/lưu trữ lớp; lớp có tên bắt buộc, độ tuổi/sĩ số/lịch hoạt động tùy chọn. |
| CLASS-02 | Trẻ là hồ sơ dùng chung giữa các lớp; có thể học nhiều lớp theo mô hình đề xuất. Không gộp hai hồ sơ chỉ vì trùng tên. |
| CLASS-03 | Mỗi cặp lớp/bé một quan hệ tham gia; thêm trùng bị chặn ở cả API/database. |
| CLASS-04 | Thêm vào chỗ cuối phải kiểm tra sĩ số trong giao dịch, không vượt số lượng khi có yêu cầu đồng thời. |
| CLASS-05 | Rút/quay lại giữ lịch sử. Quay lại không tự cấp lại những lần giao từng bị thu hồi. |
| CLASS-06 | Bé mới vào lớp chỉ nhận bài cũ giáo viên chọn chia sẻ thêm; bài giao mới lấy danh sách người nhận hiện tại. |
| CLASS-07 | Ghi chú nội bộ của bé không xuất hiện trong DTO hoặc tệp gia đình được phép xem. |

Lớp chuyển `DRAFT → ACTIVE → COMPLETED`, có thể lưu trữ/khôi phục qua hành động nghiệp vụ. Khi COMPLETED, nội dung cũ được xem theo đề xuất nhưng không nộp mới. Rời lớp hoặc lớp lưu trữ chặn quyền bài của lớp. Giao riêng cho bé và việc tham gia lớp khác được kiểm tra độc lập.

Chính sách giữ sản phẩm/nhận xét/phí của bé ở phần lịch sử sau nghỉ học là đề xuất Q-08; không được dùng chính sách này để mở lại bài gốc đã thu hồi.

## 4. Phân quyền phải áp dụng

| Tài nguyên | Giáo viên | Phụ huynh |
|---|---|---|
| Lớp, toàn bộ danh sách trẻ/liên hệ | Quản lý | Chỉ lớp/thông tin của con được phép hiển thị |
| Ghi chú riêng và mặc định học phí lớp | Quản lý | Không xem ghi chú riêng/chính sách của trẻ khác |
| Hồ sơ, nhận xét chia sẻ, sản phẩm, phí | Quản lý trong không gian cá nhân | Đúng bé đang liên kết và đúng phạm vi chia sẻ |
| Vai trò, lời mời, liên kết gia đình | Quản lý theo nghiệp vụ | Không tự sửa để cấp quyền |
| Kho lưu/OAuth Drive | Cấu hình | Không truy cập cấu hình/bí mật |

Kiểm tra quyền ở API theo tài nguyên, kể cả danh sách, tổng số, tìm kiếm, thống kê và file. Quyền hiển thị menu không thay cho kiểm tra backend.

## 5. Dữ liệu và API cần triển khai

| Nhóm | Bảng | API chính sau `/api/v1` |
|---|---|---|
| Tài khoản | `users`, `auth_identities`, `auth_tokens` | `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/register`, `/auth/csrf` |
| Google/phương thức | `auth_identities`; OAuth context trong session | `/auth/google/start`, `/auth/google/authorize`, `/auth/google/callback`, `/auth/methods`, các thao tác reauthenticate/link/unlink |
| Xác minh/mật khẩu | `auth_tokens` | Các endpoint email-verifications, password-reset, password-setup theo tổng quan |
| Hồ sơ/lớp | `students`, `classes`, `class_enrollments` | `/students`, `/classes`, `/classes/{classId}/enrollments`, `/enrollments/{enrollmentId}` |
| Gia đình | `guardian_invitations`, `student_guardians` | `/students/{studentId}/guardian-invitations`, `/guardian-invitations/accept`, các thao tác revoke, `/family/children` |

Các hậu tố hành động lớp phải mở rộng thành đường dẫn đầy đủ trong OpenAPI, ví dụ `/classes/{classId}/complete`. Phụ huynh dùng DTO gia đình; không tái sử dụng toàn bộ DTO quản lý giáo viên.

## 6. Màn hình

- Đăng nhập/đăng ký: email/mật khẩu, nút Google, trạng thái lỗi/hủy, tiếp tục lời mời.
- Tài khoản: phương thức đã liên kết, thêm mật khẩu, xác thực lại, đăng xuất.
- Giáo viên: danh sách/chi tiết lớp; danh sách/hồ sơ bé; tạo và thu hồi lời mời.
- Gia đình: chọn con, lớp của con, trạng thái chờ mời/chờ xác minh/hết quyền.

<a id="acceptance"></a>
## 7. Nghiệm thu

Đối chiếu `AC-01`–`AC-07`, `AC-15`–`AC-16`, `AC-30`, `AC-32`, `AC-42`–`AC-48` tại [bộ nghiệm thu gốc](../01-mo-ta-he-thong.md#s13).

- Google-only có thể đăng ký đúng lời mời, không cần password hash giả.
- Email trùng tài khoản cũ yêu cầu liên kết có chứng minh quyền sở hữu; không tạo quyền truy cập ngầm.
- Hai yêu cầu nhận cùng lời mời/thêm cùng bé không tạo dữ liệu trùng.
- Thay user/child/class ID không đọc được dữ liệu ngoài quyền, kể cả khi tải tệp hoặc gọi thống kê.
- Thu hồi/rút lớp có hiệu lực cho các yêu cầu mới; backend không tin quyền đã cache ở React.
- Thiếu CSRF, phiên hết hạn và tài khoản khóa có phản hồi phù hợp, không lộ hồ sơ.

## 8. Chi tiết áp dụng trong mốc tài khoản/lớp

- `/auth/setup-status` và `/auth/setup` khởi tạo giáo viên một lần; cần CSRF và mã cài đặt ít nhất 32 ký tự. Database có unique index một TEACHER. `/auth/register` được bổ sung ở TC-008, chỉ tạo PARENT với lời mời hợp lệ.
- Password mới 12–128 ký tự, PBKDF2-HMAC-SHA256/salt ngẫu nhiên. Khởi tạo bằng mã cài đặt không tự đánh dấu email đã xác minh.
- Session bộ nhớ, timeout 30 phút; đổi session ID/CSRF khi login. React lấy CSRF sau login/logout, không lưu session/password trong localStorage và xử lý 401 khi đang sử dụng.
- Đối chiếu role/trạng thái trong database mỗi request đã đăng nhập. Parent không đọc danh sách/tổng số hoặc sửa tài nguyên quản lý; tài nguyên ngoài chủ sở hữu trả 404.
- Sĩ số tính enrollment ACTIVE. DRAFT/ACTIVE nhận thành viên; COMPLETED/ARCHIVED không nhận/đổi thành viên. Kết thúc lớp đổi các ACTIVE enrollment thành COMPLETED cùng giao dịch.
- Archive/restore lớp giữ trạng thái trước lưu trữ. Hồ sơ bé chỉ lưu trữ khi không còn enrollment ACTIVE; khôi phục không tự tham gia lại lớp.
- PATCH enrollment cần version/lý do; giữ ID/joinedAt và audit. Nội dung đã thu hồi không tự cấp lại khi module học liệu được bổ sung.
- PATCH lớp/bé nhận đầy đủ biểu mẫu với version; trường tùy chọn bỏ qua sẽ xóa giá trị. UI luôn gửi đủ các trường.

## 9. Chi tiết đã áp dụng cho lời mời/email/gia đình

- Lời mời mặc định 48 giờ; phát hành lại cùng bé/email thu hồi lời mời PENDING cũ. Token ngẫu nhiên 32 byte, lưu hash SHA-256. Preview chỉ trả tên giáo viên/email che/trạng thái, chưa có tên/ID bé.
- `/auth/register` cần lời mời/email khớp; tạo PARENT chưa xác minh, không tự liên kết bé. Phụ huynh phải đăng nhập, xác minh email rồi gọi accept; mỗi lời mời chỉ nhận một lần trong giao dịch có khóa theo bé.
- VERIFY_EMAIL có hạn 24 giờ; RESET_PASSWORD 30 phút. Gửi lại xác minh vô hiệu link cũ. Token sai mục đích, đã dùng, hết hạn hoặc tài khoản khóa đều bị chặn.
- Reset request có cùng status/body bất kể tài khoản có hay không; không tạo phương thức mật khẩu mới. Reset thành công đổi password_changed_at, session filter làm mất hiệu lực phiên cũ ở yêu cầu tiếp theo.
- Link chứa token ở fragment và được UI xóa khỏi thanh địa chỉ sau khi đọc; không lưu token trong localStorage hoặc application log. SMTP lỗi trong đăng ký rollback tài khoản/token; không log nội dung email thất bại.
- Danh sách/hồ sơ/lớp family kiểm tra PARENT đã xác minh và liên kết ACTIVE, dùng DTO riêng. Không có ghi chú nội bộ, bạn học hoặc tổng số ngoài quyền. Class DRAFT/ARCHIVED, enrollment WITHDRAWN bị lọc trước phân trang.
- Thu hồi liên kết một bé không ảnh hưởng bé khác. Cấp lại cần lời mời mới hợp lệ; giữ ID liên kết và lịch sử audit. Profile ARCHIVED của đúng bé còn liên kết có thể xem thông tin tối thiểu ở lịch sử; quyền bài học triển khai riêng.
- Mailpit local/test tách biệt; SMTP thử nghiệm có bằng chứng, nhà cung cấp email thật chưa kiểm tra. Mặc định cooldown một email/phút và dùng cùng rate limit IP cho endpoint tài khoản/lời mời; proxy production cần cấu hình ở TC-027.

## 10. Chi tiết đã áp dụng cho Google và phương thức

- V4 thêm `auth_identities` và `users.credential_version`. Identity còn liên kết là duy nhất theo provider/issuer/subject và theo user/provider; giữ lịch sử khi hủy. Google-only có password hash NULL và vẫn đăng nhập session bình thường.
- `POST /auth/google/start` có CSRF, intent LOGIN/REGISTER/LINK/REAUTHENTICATE và OAuth context trong session có hạn 5 phút. Authorization code có PKCE S256, state/nonce một lần; Spring Security xác minh ID token. Callback thay OAuth principal bằng UserPrincipal lấy role/trạng thái từ database.
- Đăng ký Google chỉ tạo PARENT từ lời mời đúng email. Gmail đã xác minh hoặc Workspace có `hd` và email đã xác minh được nhận quyền trong cùng giao dịch. Email bên thứ ba chưa đủ tin cậy cần thư xác minh, chưa cấp quyền bé. Email trùng tài khoản chưa liên kết trả ACCOUNT_LINK_REQUIRED, không tự merge.
- Login Google chỉ xin `openid email profile`; authorized-client repository không lưu access/refresh token. React chỉ nhận kết quả an toàn từ `/auth/google/result`, không nhận Google token/subject hoặc URL redirect tùy ý. Kết quả có hạn 10 phút để đọc lại an toàn khi render.
- Trang Tài khoản dùng `/auth/methods`. Đăng nhập thông thường chưa đủ cho thay đổi phương thức; cần `/auth/reauthenticate` bằng mật khẩu hoặc Google REAUTHENTICATE đúng identity đã liên kết. Chứng minh chủ tài khoản ràng buộc user/credential version, có hạn 5 phút và dùng một lần.
- LINK giữ user ID/role/email liên hệ; có thể liên kết email Google khác sau xác thực lại. Identity của tài khoản khác hoặc đã liên kết bị chặn. Hủy Google chỉ cho identity đang thuộc tài khoản và khi còn mật khẩu; không hủy phương thức cuối cùng.
- `/auth/password-setup-requests` dành cho Google-only ACTIVE, đã xác minh email và có chứng minh xác thực lại. Token SET_PASSWORD băm, hạn 30 phút, đúng chủ tài khoản đang đăng nhập. `/auth/password-setups` thêm mật khẩu 12–128 ký tự, không gỡ Google; RESET_PASSWORD không dùng thay được.
- Link/hủy/thêm mật khẩu tăng credential version. Link giữ phiên hiện tại với snapshot mới; hủy/thêm mật khẩu kết thúc phiên hiện tại. Phiên khác bị từ chối ở request tiếp theo. Sai mật khẩu xác thực lại không tự kết thúc phiên đang có.
- Google mặc định tắt; bật cần Web OAuth client và callback đúng public URL theo [hướng dẫn](../07-google-login-local.md). Provider dùng kiểm thử nằm riêng trong src/test, không được đóng gói production. Kết quả mock không thay nghiệm thu Google thật hoặc Drive.

