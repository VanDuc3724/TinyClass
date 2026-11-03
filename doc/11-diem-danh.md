# TinyClass — Điểm danh theo buổi

Cập nhật 02/11/2026. TC-018 triển khai điểm danh; **học bù tạm hoãn theo yêu cầu người dùng**. Học phí và nhận xét định kỳ là các module tiếp theo.

## Giáo viên sử dụng

1. Vào **Lịch dạy**, chọn buổi, bấm **Điểm danh**. Trang **Điểm danh** trong menu dùng để tra cứu các buổi đã chốt danh sách.
2. Bấm **Chốt danh sách điểm danh**. Hệ thống giữ danh sách và tên bé riêng cho buổi; việc đổi tên, thêm bé hoặc bé rời lớp sau đó không tự viết lại danh sách này. Chốt lại trả về danh sách đã có, kể cả danh sách rỗng.
3. Chọn trạng thái cho từng bé. **Đánh dấu các bé còn lại có mặt** chỉ điền những bé đang chưa đánh dấu; giữ nguyên lựa chọn báo nghỉ/đi muộn đã nhập. Thao tác nhanh áp dụng toàn bộ danh sách, kể cả bé đang bị ẩn bởi ô tìm kiếm. Bấm **Lưu … thay đổi** để ghi kết quả.
4. Mở **Ghi chú riêng và gửi gia đình** khi cần. Ghi chú riêng chỉ cô xem; ghi chú gửi gia đình xuất hiện trong kết quả và lịch sử của bé. Khi sửa một kết quả đã đánh dấu, cần lý do riêng để đối chiếu.
5. Sau giờ kết thúc, khi không còn bé chưa đánh dấu, bấm **Hoàn thành buổi học**. Danh sách rỗng cần lý do. Vẫn được sửa kết quả đã hoàn thành kèm lý do; nếu đưa một bé về chưa đánh dấu hoặc bổ sung bé chưa đánh dấu, buổi mở lại để xử lý tiếp.

| Trạng thái | Ý nghĩa |
|---|---|
| Chưa đánh dấu | Cô chưa ghi nhận; không tự coi là vắng |
| Có mặt | Bé tham gia buổi |
| Đi muộn | Bé tham gia và đến muộn |
| Nghỉ có phép | Gia đình đã báo nghỉ |
| Nghỉ chưa báo | Chưa nhận được thông tin báo nghỉ |

Có mặt/đi muộn chỉ ghi từ khi buổi bắt đầu. Có thể ghi báo nghỉ trước. Dùng **Cập nhật kết quả** khi đã tới giờ để lấy lại trạng thái thao tác mới nhất.

## Điều chỉnh danh sách và sửa lỗi

- **Bổ sung bé** chỉ chọn thành viên phù hợp của chính lớp đó, có lý do, kiểm tra thời gian tham gia và sĩ số. Bé đã loại được khôi phục với tên/kết quả cũ. Chưa hỗ trợ bé từ lớp khác tham gia theo kế hoạch bù.
- **Loại khỏi buổi** giữ dòng cũ và lịch sử, dừng tính bé vào kết quả buổi; việc tham gia lớp không thay đổi. Xem các dòng này ở phần **Bé đã loại khỏi danh sách buổi**.
- Lưu thay đổi trước khi thêm/loại bé hoặc hoàn thành buổi. Có cảnh báo khi tải lại biểu mẫu đang sửa. Nếu mạng lỗi hoặc có cửa sổ khác cập nhật, bản nhập hiện tại được giữ; xem lỗi rồi chọn cập nhật lại khi sẵn sàng bỏ bản nhập cũ.
- Mỗi lần lưu kiểm tra phiên bản buổi và toàn bộ dòng gửi lên trước khi ghi. Một dòng lỗi làm cả lượt không ghi; không có tình trạng lưu một phần âm thầm.
- Buổi bị hủy hoặc lớp đã lưu trữ chỉ xem lại. Buổi hủy giữ trạng thái cũ để đối chiếu và không tính kết quả tham gia. Lớp đã kết thúc cho sửa buổi quá khứ phù hợp; buổi tương lai của lớp kết thúc chỉ đọc.
- Danh sách ban đầu lấy thành viên đang đủ điều kiện lúc cô chốt, không dựng lại chính xác lịch sử lớp trong quá khứ. Với lớp hoàn thành, dùng các quan hệ hoàn thành phù hợp ngày buổi; điều chỉnh trường hợp khác bằng thêm/loại có lý do. Tối đa 500 bé/buổi.

## Phụ huynh và số liệu hôm nay

Từ hồ sơ bé chọn **Điểm danh của bé**, hoặc chọn mục tương ứng trong menu. Phụ huynh có email đã xác minh và liên kết còn hiệu lực được xem trạng thái, ghi chú chia sẻ và lịch sử đúng bé, kể cả sau khi rời lớp/lưu trữ. Thu hồi liên kết chặn cả kết quả và lịch sử ngay ở yêu cầu tiếp theo. Việc giữ lịch sử này không cấp lại quyền xem bài của lớp đã rời.

Danh sách tương lai chưa đánh dấu không hiện như kết quả đã học. Báo nghỉ sớm/buổi hủy có thể xuất hiện. Phụ huynh không nhận ghi chú riêng, lý do sửa riêng, phiên bản dòng, mã thành viên lớp hoặc dữ liệu bé khác.

Dashboard **Bé có mặt hôm nay** đếm bé có mặt/đi muộn trong buổi hôm nay, mỗi bé một lần trong phạm vi lớp được chọn. Bỏ bé đã loại và buổi hủy; buổi đã hoàn thành vẫn nằm trong số buổi hôm nay. Số liệu không suy đoán từ danh sách lớp và không tự tính học phí.

## Dữ liệu và API

V10 thêm `attendance_records`, `attendance_events` và mốc/người hoàn thành vào `class_sessions`. Mỗi cặp buổi/bé có một dòng duy nhất; sự kiện và audit giữ lịch sử. Các lần ghi dùng cùng khóa giao dịch theo giáo viên với lịch dạy, rồi khóa lớp/buổi.

| API | Công dụng |
|---|---|
| `GET/PUT /api/v1/sessions/{id}/attendance` | Đọc không gian điểm danh / lưu nguyên tử các dòng thay đổi |
| `POST /api/v1/sessions/{id}/attendance-roster` | Chốt danh sách một lần |
| `POST /api/v1/sessions/{id}/attendance-roster/members` | Thêm/loại/khôi phục bé có lý do |
| `POST /api/v1/sessions/{id}/complete` | Hoàn thành buổi đủ điều kiện |
| `GET /api/v1/attendance` | Lọc ngày/lớp/bé/trạng thái; phân trang |
| `GET /api/v1/attendance/{id}/history` | Lịch sử của cô, gồm lý do riêng |
| `GET /api/v1/family/children/{child}/attendance` | Kết quả công khai đúng bé |
| `GET /api/v1/family/children/{child}/attendance/{id}/history` | Lịch sử chia sẻ đúng bé |

API tra cứu chọn `from`/`to` theo ngày Việt Nam, tối đa 93 ngày; phân trang tối đa 100 dòng/lần. Xem [OpenAPI](spec/openapi.yaml), [plan](plan/2026-11-02-attendance.md) và [báo cáo kiểm tra](verification/2026-11-02-attendance.md).
