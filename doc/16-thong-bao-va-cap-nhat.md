# TinyClass — Thông báo lớp và cập nhật cá nhân

Cập nhật **03/11/2026**, TC-024/V17. Cô có bảng tin theo lớp; mỗi tài khoản có hộp cập nhật riêng. Các mục dưới đây hoạt động trong ứng dụng TinyClass.

## Soạn và đăng bảng tin

1. Mở **Thông báo lớp** trong menu hoặc từ chi tiết lớp, chọn **Soạn thông báo**.
2. Chọn lớp, nhập tiêu đề tối đa 200 ký tự và nội dung tối đa 10.000 ký tự; **Lưu bản nháp**. Bản nháp chỉ cô xem. Lớp chuẩn bị hoặc đang dạy được tạo nháp.
3. Mở nháp, kiểm tra nội dung rồi **Đăng cho gia đình**. Lớp phải đang dạy. Phụ huynh đủ quyền nhận cập nhật và xem bài trên bảng tin của bé.
4. **Chỉnh sửa thông báo** cần lý do riêng, tối đa 1.000 ký tự. Nếu đã đăng, lưu sẽ công bố bản mới, tăng số bản và yêu cầu phụ huynh đọc lại. Nội dung cũ/lý do được giữ trong **Lịch sử thông báo**, chỉ cô xem.
5. **Lưu trữ thông báo** cần lý do riêng. Thông báo ngừng hiện cho gia đình và trong hộp cập nhật của họ; cô vẫn xem nội dung/lịch sử, lọc **Đã lưu trữ**. Lưu trữ là trạng thái kết thúc của thông báo này.

Nội dung là chữ thuần, giữ xuống dòng; không thực thi HTML, không có tệp đính kèm trong mốc này. Cô sửa được nháp hoặc bản đã đăng khi lớp chưa lưu trữ; lớp đã kết thúc không đăng nháp mới. Việc mở form hoặc xem trước không gửi thông báo.

Mỗi lần mở form tạo có một mã gửi. Nếu phản hồi mất sau khi backend đã lưu, gửi lại cùng nội dung sẽ lấy đúng bản cũ. Nếu sửa nội dung với mã đã dùng, hệ thống báo xung đột; đối chiếu bản đã có trước khi tạo mới. Form giữ chữ khi 503/409; **Đóng và cập nhật** cần xác nhận bỏ bản nhập rồi lấy phiên bản hiện tại.

## Gia đình đọc đúng bảng tin

Từ hồ sơ bé hoặc menu, mở **Thông báo lớp**, chọn **Xem thông báo**. Gia đình chỉ thấy thông báo đã đăng của lớp bé hiện còn quyền xem: email đã xác minh, liên kết giám hộ còn hiệu lực, bé hoạt động, lớp và quan hệ tham gia ACTIVE/COMPLETED.

**Đánh dấu đã đọc** xác nhận đúng bản công bố đang xem. Nếu cô đã sửa ở cửa sổ khác, thao tác báo xung đột; dùng **Cập nhật thông báo**, đọc bản mới rồi xác nhận. Dấu đọc thuộc tài khoản phụ huynh và thông báo lớp; hai người giám hộ có dấu đọc riêng. Nếu một tài khoản có hai bé trong cùng lớp, đọc thông báo đó một lần là đủ cho tài khoản này.

Rời lớp, lưu trữ lớp/hồ sơ, lưu trữ thông báo hoặc thu hồi liên kết chặn list/count/detail/read ở yêu cầu tiếp theo. Đổi bé từ chi tiết trở về bảng tin bé mới và bỏ nội dung bé cũ. Gia đình không có nháp, lý do riêng, version quản trị, mã gửi/hash, audit hoặc danh sách người giám hộ khác. Public `revision` chỉ dùng để xác nhận bản đã đọc.

## Hộp cập nhật và chuông

Nhấn chuông trên topbar hoặc **Cập nhật của bạn** trong menu. Có bộ lọc tất cả/chưa đọc/đã đọc. **Đánh dấu đã đọc** xử lý từng mục; **Xem cập nhật** kiểm tra lại quyền, đánh dấu mục rồi mở nguồn tương ứng. Đọc một mục cập nhật không tự xác nhận rằng gia đình đã đọc toàn bộ nội dung thông báo lớp.

| Sự kiện | Người nhận và nơi mở |
|---|---|
| Cô đăng/sửa thông báo đã đăng | Người giám hộ đủ điều kiện của các bé trong lớp → thông báo lớp |
| Cô xuất bản lần giao/cấp lại quyền cho bé | Người giám hộ của bé nhận quyền → lần giao bài |
| Gia đình gửi sản phẩm | Giáo viên sở hữu lần giao → trang phản hồi |
| Cô chấp nhận/yêu cầu bổ sung sản phẩm | Người giám hộ của bé → lịch sử sản phẩm |
| Cô tạo/đổi/hủy buổi, gồm thay đổi từ lịch tuần | Người giám hộ của bé trong lớp → lịch học theo bé |
| Phát hành phiếu học phí | Người giám hộ của bé → phiếu công khai |
| Ghi thu/hủy bản ghi thanh toán nhập sai | Người giám hộ của bé → phiếu và lịch sử thanh toán |

Chỉ người giám hộ đang hoạt động với tài khoản đã xác minh tại thời điểm phát sinh nhận mục mới. Nâng cấp hệ thống không gửi lại các sự kiện cũ. Quyền đọc nguồn được kiểm tra lại khi liệt kê, đếm chưa đọc, mở hoặc đánh dấu: mục đã mất quyền không góp vào số tổng/chưa đọc, và ID cũ không mở được nguồn.

Bài/lịch/bảng tin theo quyền hiện tại. Sản phẩm đã gửi, phiếu từng phát hành và lịch sử thanh toán giữ theo quyền lịch sử của module khi bé rời lớp, miễn liên kết giám hộ còn hiệu lực. Thu hồi liên kết chặn cả các mục lịch sử đó. Cập nhật không cấp thêm quyền bài học hoặc quyền sau khi đóng học phí.

Chuông tải khi điều hướng, quay lại cửa sổ, sau thao tác đọc và mỗi 60 giây khi cửa sổ hiển thị. Khi cần số liệu ngay, chọn **Cập nhật danh sách**. Không có WebSocket, email/SMS nghiệp vụ hoặc gửi thông báo ngoài ứng dụng ở mốc này.

## Dữ liệu và API

V17 thêm `class_announcements`, `announcement_reads`, `notifications`. Nguồn phát sinh đăng ký sự kiện qua `DomainStore.audit`; listener BEFORE_COMMIT tạo cập nhật trong chính giao dịch nghiệp vụ. Chỉ sau commit mới nhìn thấy thay đổi; rollback không để lại mục giả. Unique `(recipient_user_id, dedupe_key)` theo loại/nguồn/phiên bản/bé chặn trùng do retry. Riêng thao tác cấp quyền bài chỉ phát cho những bé được cấp trong giao dịch đó.

Không sao chép nội dung bài, phản hồi, tiền, ghi chú riêng, lý do sửa, email hoặc token vào payload cập nhật. Dòng lưu chỉ gồm loại/ID nguồn/bé/lớp/chủ sở hữu/người nhận, khóa chống lặp và thời điểm tạo/đọc. Backend sinh câu chữ chung, tên hiện tại và đường dẫn nội bộ sau khi lọc quyền. Dấu đọc cá nhân giữ thời điểm đọc đầu tiên khi gửi lại.

| API sau `/api/v1` | Chức năng |
|---|---|
| `GET/POST /announcements` | Cô tìm/lọc lớp/trạng thái/tiêu đề hoặc tạo nháp |
| `GET/PUT /announcements/{id}` | Chi tiết cô/sửa nội dung theo version và lý do |
| `POST /announcements/{id}/publish` | Đăng nháp, gửi lại không nhân đôi |
| `POST /announcements/{id}/archive` | Lưu trữ có lý do, giữ lịch sử |
| `GET /announcements/{id}/history` | Audit trước/sau chỉ cô xem |
| `GET /family/children/{child}/announcements` | Trang bảng tin đúng bé; tùy chọn classId |
| `GET /family/children/{child}/announcements/{id}` | Nội dung công khai hiện tại |
| `POST /family/children/{child}/announcements/{id}/read` | Xác nhận revision đã xem |
| `GET /notifications` | Cập nhật tài khoản hiện tại; status UNREAD/READ hoặc bỏ lọc |
| `GET /notifications/unread-count` | Tổng chưa đọc của các nguồn còn quyền |
| `GET /notifications/{id}` | Chi tiết/đường dẫn hiện còn quyền |
| `POST /notifications/{id}/read` | Đọc/mở, kiểm tra quyền lại, giữ readAt đầu tiên |

Các thao tác ghi cần session/CSRF; backend xác định actor/người nhận/quyền, không nhận các trường đó từ React. Danh sách mặc định 12, history 10, size tối đa 100. 400 cho dữ liệu/phân trang không hợp lệ, 409 cho version/revision/trạng thái hoặc mã gửi đã dùng cho dữ liệu khác, 403 cho vai trò/CSRF/email chưa xác minh, 404 cho nguồn ngoài quyền. Có chi tiết ở [OpenAPI](spec/openapi.yaml), [plan](plan/2026-11-03-notifications.md) và [báo cáo/ảnh](verification/2026-11-03-notifications.md).
