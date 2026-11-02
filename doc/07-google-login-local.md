# TinyClass — Cấu hình đăng nhập Google

Người dùng yêu cầu tạm hoãn cấu hình đăng nhập Google ngày 02/11/2026. Tài liệu này giữ để dùng sau; không cần thực hiện để chạy lớp/gia đình/học liệu LOCAL bằng email/mật khẩu.

Cập nhật: 02/11/2026. Mã đăng nhập/đăng ký, liên kết/hủy Google và thêm mật khẩu đã được triển khai. Kiểm thử hiện dùng máy chủ OIDC có chữ ký trong môi trường riêng; **chưa xác minh với Google thật** vì workspace chưa được cấp OAuth client. Theo dõi [TC-009](plan/02-backlog.md#tc-009) và [báo cáo kiểm tra](verification/2026-11-02-google.md).

## 1. Tạo OAuth client

Trong [Google Cloud Console](https://console.cloud.google.com/), chọn/tạo project, cấu hình màn hình đồng ý OAuth và tạo client loại **Web application** theo [hướng dẫn OpenID Connect của Google](https://developers.google.com/identity/openid-connect/openid-connect). Nếu ứng dụng ở chế độ Testing, thêm những tài khoản sẽ thử vào danh sách test users.

Với frontend local mặc định của TinyClass, khai báo **Authorized redirect URI** chính xác:

```text
http://localhost:5173/api/v1/auth/google/callback
```

Callback đi qua Vite proxy đến backend. Luôn truy cập frontend bằng `http://localhost:5173`; `localhost` và `127.0.0.1` là hai host khác nhau đối với cookie. Nếu đổi host/cổng, cập nhật đồng thời URI tại Google, `TINYCLASS_PUBLIC_URL` và địa chỉ đang mở trên trình duyệt. Khi vận hành, dùng URL HTTPS cùng origin cho giao diện và `/api/*`, cấu hình proxy tương ứng.

Đăng nhập chỉ xin `openid email profile`. Không cần bật Drive API hay cấp quyền Drive trong bước này. Client secret chỉ nằm ở backend; frontend không cần biến `VITE_*` chứa OAuth secret.

## 2. Bật ở local

Mở `.env` tại thư mục gốc và thêm/sửa các biến bên dưới bằng thông tin client của bạn:

```dotenv
TINYCLASS_PUBLIC_URL=http://localhost:5173
TINYCLASS_GOOGLE_LOGIN_ENABLED=true
TINYCLASS_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
TINYCLASS_GOOGLE_CLIENT_SECRET=your-client-secret
```

Không đưa giá trị thật vào `.env.example`, commit Git hoặc gửi qua hội thoại. Khởi động lại backend từ `Backend/` bằng `mvnw.cmd spring-boot:run`, chạy frontend theo [README](../README.md). `GET /api/v1/auth/providers` trả `googleEnabled: true` khi client đã được đăng ký; điều này chỉ chứng minh cấu hình được nạp, chưa chứng minh Google đã chấp nhận callback.

Google mặc định tắt. Thiếu client ID/secret hoặc public URL không hợp lệ khi bật sẽ làm backend báo lỗi cấu hình lúc khởi động. Không bật khi chưa điền đủ. Production đọc các biến môi trường của dịch vụ, không tự nhập file `.env` local.

## 3. Giáo viên và phụ huynh sử dụng

| Tình huống | Các bước |
|---|---|
| Giáo viên dùng Google | Khởi tạo/đăng nhập giáo viên bằng email và mật khẩu → **Tài khoản → Liên kết Google** → nhập lại mật khẩu → chọn Google. Tài khoản, vai trò và dữ liệu giữ nguyên. |
| Phụ huynh mới | Giáo viên tạo lời mời đến đúng email → mở lời mời ở trình duyệt riêng → **Đăng ký với Google** → chọn email được mời. Không cần nhập mật khẩu nội bộ. |
| Phụ huynh đã có tài khoản mật khẩu | Đăng nhập theo cách đang có → Tài khoản → liên kết Google sau xác thực lại. Google cùng email chưa liên kết sẽ yêu cầu bước này. |
| Đăng nhập sau khi liên kết | Tại `/login`, chọn **Tiếp tục với Google** và đúng tài khoản đã liên kết. |
| Thêm mật khẩu cho Google-only | Tài khoản → **Thêm mật khẩu** → xác thực lại bằng Google → chọn Thêm mật khẩu lần nữa → mở email trong cùng trình duyệt đang đăng nhập → đặt mật khẩu. Các phiên cũ kết thúc; đăng nhập lại. |
| Hủy Google | Khi đã có mật khẩu: Tài khoản → **Hủy liên kết Google** → xác thực lại. Hệ thống đăng xuất; dùng mật khẩu để đăng nhập tiếp. |

Gmail có email đã xác minh hoặc Google Workspace có `email_verified=true` kèm `hd` được dùng để xác minh email. Với địa chỉ bên thứ ba không có `hd`, TinyClass vẫn yêu cầu xác minh bằng thư trước khi cấp quyền bé, theo [hướng dẫn xác minh phía server của Google](https://developers.google.com/identity/sign-in/web/backend-auth). Ở local, thư nằm trong Mailpit tại `http://localhost:18025`, không tới Gmail thật.

Liên kết Google có thể dùng địa chỉ khác email liên hệ khi chính chủ đã xác thực lại. Hành động này không đổi email nhận thông báo/lời mời hoặc vai trò. Sau khi liên kết, đăng nhập theo issuer/subject của Google, không tự ghép tài khoản theo email.

Xác thực lại có hạn 5 phút, dùng một lần cho một thao tác. Tài khoản Google-only không thể hủy phương thức cuối cùng. **Quên mật khẩu** chỉ khôi phục mật khẩu đã tồn tại; Google-only phải dùng luồng thêm mật khẩu ở trên.

## 4. Kiểm tra tích hợp thật trước khi sử dụng

Sau khi có client hợp lệ, thử đăng nhập giáo viên đã liên kết, đăng ký phụ huynh từ lời mời, chọn sai email/hủy đăng nhập, thêm mật khẩu và hủy Google. Kiểm tra cùng tài khoản/dữ liệu, không tạo thêm giáo viên; không đưa token/secret vào ảnh hoặc log. Ghi môi trường và kết quả vào báo cáo TC-009 rồi mới nghiệm thu tích hợp Google thật.

Nếu Google báo `redirect_uri_mismatch`, đối chiếu đầy đủ scheme/host/cổng/path, không chỉ tên miền. Nếu liên kết thất bại vì email đã tồn tại, đăng nhập bằng phương thức cũ rồi liên kết tại Tài khoản. Không tạo tài khoản trùng để bỏ qua bước xác minh chủ sở hữu.

## 5. Kiểm thử tự động không dùng tài khoản thật

Theo các lệnh kiểm tra trong [README](../README.md). Maven dùng PostgreSQL test, Mailpit test và máy chủ OIDC local ký JWT bằng RSA; kiểm tra callback thực sự qua Spring Security. Playwright chạy ứng dụng bằng `spring-boot:test-run` theo [tài liệu Maven plugin của Spring Boot](https://docs.spring.io/spring-boot/maven-plugin/api/java/org/springframework/boot/maven/TestRunMojo.html), với provider riêng tại cổng 19090 và màn hình ghi rõ đây là giả lập.

Các lớp provider và ứng dụng E2E nằm trong `Backend/src/test/`, không nằm trong JAR production. Chạy bình thường bằng `spring-boot:run` hoặc `java -jar` không cung cấp máy chủ giả lập. Google login không lưu access/refresh token làm thông tin kết nối Drive; phần kho Drive được triển khai ở TC-011.
