# TinyClass

Hệ thống quản lý lớp dạy tại nhà cho một giáo viên cá nhân, dùng React/TypeScript và Spring Boot/Java 21.

## Trạng thái hiện tại

Đã triển khai TC-001 đến TC-008: nền tảng Spring Boot/PostgreSQL, tài khoản/session/CSRF, lớp/bé/thành viên và lịch sử, mời/đăng ký phụ huynh, xác minh/khôi phục mật khẩu qua email và gia đình xem đúng con/lớp. Giao diện React dùng API thật, dữ liệu lưu trong PostgreSQL.

Đã có thêm TC-010/012/013/014: kho LOCAL, chủ đề/bài/khóa học, giao bài theo lớp hoặc riêng bé, thời điểm mở và Góc học của bé với xác nhận tiến độ. Xem [hướng dẫn học liệu](doc/08-hoc-lieu-local.md) và [báo cáo mới nhất](doc/verification/2026-11-02-learning.md).

Giao diện hiện dùng theme tím, Nunito tiếng Việt tự phục vụ, CSS variables + CSS Modules theo [Design.md](frontend/Design.md). Dashboard lấy số liệu thật theo lớp; có drawer tablet/mobile, bộ lọc mobile và thanh gia đình/bộ chọn bé. Xem [báo cáo giao diện](doc/verification/2026-11-02-design.md).

Cấu hình Google thật tạm hoãn theo yêu cầu; các luồng trên dùng email/mật khẩu, không cần Google. Mã Google của TC-009 có kiểm thử riêng. Drive, nộp/duyệt sản phẩm, lịch/điểm danh và học phí tiếp tục theo [backlog](doc/plan/02-backlog.md).

## Yêu cầu phát triển

- Java 21 và Node phù hợp phiên bản Vite trong lockfile.
- Docker Desktop đang chạy để dùng PostgreSQL trong Compose.
- Lần build đầu cần tải phụ thuộc Maven/npm và Docker image.

## Chuẩn bị local

Chạy từ thư mục gốc trong PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Backend\scripts\Initialize-LocalEnvironment.ps1
docker compose up -d --wait postgres mailpit
```

Script tạo `.env` với hai mật khẩu database và mã khởi tạo giáo viên ngẫu nhiên. Nếu `.env` đã có, script giữ cấu hình hiện tại và bổ sung `TINYCLASS_SETUP_KEY` khi thiếu/trống. Giá trị bí mật không được in ra. `.env` được gitignore; `.env.example` chỉ ghi cấu hình mẫu. PostgreSQL phát triển dùng cổng loopback 55432 và volume `postgres_data` của project Compose `tinyclass-local`.

Chạy backend từ đúng thư mục `Backend/` để profile local đọc `../.env`:

```powershell
cd Backend
.\mvnw.cmd spring-boot:run
```

Kiểm tra `http://127.0.0.1:8080/api/v1/health`:

```json
{"data":{"status":"UP"}}
```

Mở terminal khác, từ thư mục gốc:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Mở địa chỉ Vite hiển thị. Request `/api/*` qua dev server được chuyển đến backend cổng 8080. Nếu đổi cổng backend, đặt biến `TINYCLASS_API_PROXY_TARGET` trước khi chạy Vite cho khớp, ví dụ `$env:TINYCLASS_API_PROXY_TARGET='http://127.0.0.1:8081'`.

## Tạo tài khoản giáo viên và chạy thử

1. Mở ứng dụng React. Khi chưa có giáo viên, ứng dụng chuyển đến `/setup`.
2. Mở `.env` ở máy của bạn, lấy riêng giá trị `TINYCLASS_SETUP_KEY` để nhập vào ô **Mã khởi tạo**. Không gửi toàn bộ `.env` hoặc mật khẩu database lên giao diện.
3. Chọn tên, email và mật khẩu từ 12 đến 128 ký tự. Hoàn tất khởi tạo rồi đăng nhập bằng thông tin vừa chọn.
4. Tạo lớp → thêm hồ sơ bé → chọn bé vào lớp → mở lớp. Có thể thử rời/quay lại và mở lịch sử của thành viên.

Không có email/mật khẩu giáo viên mặc định, không tự tạo dữ liệu demo trong database phát triển. Một tài khoản giáo viên duy nhất được bảo đảm bằng unique index; `/auth/setup` đóng sau khởi tạo. Đây là khởi tạo chủ hệ thống, tách với đăng ký phụ huynh qua lời mời ở TC-008.

## Mời và thử tài khoản phụ huynh

1. Trong hồ sơ bé, chọn **Mời phụ huynh**, nhập email, tạo lời mời rồi sao chép liên kết để tự gửi cho người nhận.
2. Để chạy thử, mở liên kết bằng trình duyệt khác/cửa sổ riêng tư. Chọn tạo tài khoản phụ huynh hoặc đăng nhập tài khoản đã có bằng đúng email được mời.
3. Ở local, mở hộp thư thử nghiệm **http://localhost:18025**, chọn email xác minh của phụ huynh và mở liên kết trong cùng cửa sổ trình duyệt đang dùng tài khoản đó. Mailpit bắt thư local, không chuyển email tới Gmail thật.
4. Xác minh email → tiếp tục lời mời → nhận lời mời. Phụ huynh thấy hồ sơ/lớp của đúng bé, không thấy ghi chú riêng hoặc danh sách bạn học.
5. Giáo viên thu hồi liên kết trong hồ sơ bé; request gia đình tiếp theo bị chặn với bé đó, các bé khác được giữ quyền.

Trang **Quên mật khẩu** gửi hướng dẫn vào cùng hộp thư local. Link xác minh có hạn 24 giờ; reset 30 phút; lời mời mặc định 48 giờ. Không chia sẻ link xác minh/reset với người khác. Sau reset, các phiên cũ hết hiệu lực ở lần gọi tiếp theo.

Giữ `TINYCLASS_PUBLIC_URL` trùng địa chỉ frontend, mặc định `http://localhost:5173`, để các link trong email/lời mời mở đúng ứng dụng. Nếu đổi cổng/origin, đặt biến này trong `.env` và khởi động lại backend. SMTP local mặc định 11025, UI 18025; có thể đổi bằng TINYCLASS_MAIL_PORT/TINYCLASS_MAIL_UI_PORT.

Phiên nằm trong bộ nhớ backend, hết sau 30 phút không hoạt động hoặc khi backend khởi động lại. Cookie HttpOnly/SameSite=Lax; production bật Secure. Frontend lấy lại CSRF sau đăng nhập/đăng xuất, không lưu session hoặc mật khẩu trong localStorage. Các endpoint quản lý chỉ dành cho TEACHER và lọc dữ liệu theo chủ sở hữu.

## Bật đăng nhập Google

Phần này tùy chọn và hiện tạm hoãn; có thể bỏ qua để dùng lớp/gia đình/học liệu bằng email/mật khẩu.

Google mặc định tắt. Tạo Web OAuth client, khai báo callback `http://localhost:5173/api/v1/auth/google/callback`, thêm `TINYCLASS_GOOGLE_LOGIN_ENABLED=true`, `TINYCLASS_GOOGLE_CLIENT_ID` và `TINYCLASS_GOOGLE_CLIENT_SECRET` vào `.env`, rồi khởi động lại backend. Giữ `TINYCLASS_PUBLIC_URL` và host frontend trùng callback. Làm theo [hướng dẫn đầy đủ](doc/07-google-login-local.md); không commit client secret.

Giáo viên đăng nhập bằng mật khẩu trước, vào **Tài khoản → Liên kết Google** và xác thực lại. Phụ huynh mới chọn **Đăng ký với Google** từ lời mời đúng email, không cần mật khẩu nội bộ. Tài khoản đã tồn tại phải liên kết từ bên trong sau khi đăng nhập theo cách cũ. **Tài khoản** cũng có thêm mật khẩu cho Google-only qua email và hủy Google khi còn phương thức mật khẩu. Đăng nhập Google chỉ xin danh tính; kết nối kho Drive triển khai riêng.

## Kiểm tra

Từ thư mục gốc, khởi động database và hộp thư test:

```powershell
docker compose --profile test up -d --wait
cd Backend
.\mvnw.cmd -B verify
```

`verify` kiểm tra cả profile local và test. Database test riêng `tinyclass_test` ở cổng 55433 dùng tmpfs; dữ liệu test không nằm trong database phát triển. Test HTTP chạy ở port ngẫu nhiên, audit round-trip được rollback.

Bộ kiểm tra reset dữ liệu trong `tinyclass_test` trước từng tình huống; database này dành riêng cho dữ liệu giả có thể tạo lại. Mailpit test riêng tại http://localhost:18026/SMTP 11026; không ảnh hưởng hộp thư local. Hiện verify đạt 72 test, E2E đạt 16 luồng; có migration qua V7, upload/Range/quota, học liệu/giao bài/quyền theo bé, dashboard theo lớp, kiểm tra giao diện/bàn phím, token/SMTP và OIDC có chữ ký thử nghiệm. Kết quả này không thay kiểm tra Google/SMTP thật.

Kiểm tra frontend từ thư mục `frontend/`:

```powershell
npm.cmd run build
npm.cmd run lint
```

Kiểm thử giao diện với Edge đã cài trên Windows, sau backend `verify`, khi hai database và Mailpit test đang chạy:

```powershell
cd frontend
npm.cmd run test:e2e
```

Playwright tự chạy backend kiểm thử tại 18080, Vite tại 5174 và OIDC provider thử nghiệm tại 19090, rồi dừng các tiến trình này khi xong. Script dùng test classpath, chỉ reset database `tinyclass_test` của service `postgres-test`; cấu hình database phát triển được giữ nguyên. E2E dùng tài khoản/hồ sơ giả, không kết nối Google thật; ảnh chụp ở `frontend/test-results/` được gitignore. Không chạy Maven và E2E đồng thời vì cùng dùng database test. Không bật provider thử nghiệm trên môi trường dùng dữ liệu thật.

Dừng dịch vụ test khi xong, từ thư mục gốc:

```powershell
docker compose --profile test stop postgres-test mailpit-test
```

Dừng các dịch vụ local của project bằng `docker compose --profile test stop`. Dữ liệu phát triển nằm trên volume riêng; lệnh stop giữ volume đó.

## Tài liệu

- [Tổng hợp tài liệu](doc/README.md)
- [Spec](doc/spec/README.md) và [OpenAPI hiện có](doc/spec/openapi.yaml)
- [Plan/backlog](doc/plan/README.md)
- [Kết quả kiểm tra nền tảng](doc/verification/2026-11-01-foundation.md)
- [Kết quả kiểm tra tài khoản/lớp và ảnh giao diện](doc/verification/2026-11-01-accounts-and-classes.md)
- [Kết quả kiểm tra lời mời/email/gia đình và ảnh giao diện](doc/verification/2026-11-01-family.md)
- [Cấu hình đăng nhập Google](doc/07-google-login-local.md)
- [Kết quả kiểm tra Google và phương thức đăng nhập](doc/verification/2026-11-02-google.md)
- [Hướng dẫn kho LOCAL, bài/khóa và giao bài](doc/08-hoc-lieu-local.md)
- [Kết quả học liệu/gia đình và ảnh giao diện](doc/verification/2026-11-02-learning.md)

Profile production yêu cầu các biến `TINYCLASS_DATABASE_URL`, `TINYCLASS_DATABASE_USERNAME`, `TINYCLASS_DATABASE_PASSWORD`, `TINYCLASS_UPLOAD_ROOT`, bật secure cookie và không nhập `.env` local. Upload root phải là ổ bền vững riêng tư, sao lưu cùng database.

Email production mặc định chưa bật. Khi dùng dịch vụ SMTP thật, cấu hình `TINYCLASS_MAIL_ENABLED=true`, `TINYCLASS_PUBLIC_URL` là URL HTTPS của ứng dụng, `TINYCLASS_MAIL_HOST`, `TINYCLASS_MAIL_PORT`, `TINYCLASS_MAIL_USERNAME`, `TINYCLASS_MAIL_PASSWORD` và `TINYCLASS_MAIL_FROM`. Production yêu cầu STARTTLS; kết quả Mailpit không thay cho kiểm tra nhà cung cấp thật.
