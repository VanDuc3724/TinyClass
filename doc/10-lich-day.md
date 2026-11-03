# TinyClass — Lịch dạy và lịch học của bé

Áp dụng cho TC-017, migration V9. [Báo cáo nghiệm thu](verification/2026-11-02-schedule.md), [OpenAPI](spec/openapi.yaml), [quy chuẩn giao diện](../frontend/Design.md).

## Đặt lịch tuần cho lớp

1. Mở **Lớp học → lớp cần xếp → Lịch tuần**.
2. Chọn **Thêm lịch tuần**, nhập thứ, giờ bắt đầu/kết thúc, ngày hiệu lực, ngày kết thúc nếu có và địa điểm.
3. Lưu quy tắc. Một lớp có thể có nhiều quy tắc, ví dụ thứ Hai và thứ Năm. Lớp chuẩn bị được đặt quy tắc; cần mở lớp để tạo buổi cụ thể.
4. Chọn **Sinh buổi học**, nhập khoảng ngày rồi **Xem trước các buổi**.
5. Kiểm tra số buổi, thời gian và cảnh báo; chọn **Xác nhận sinh lịch** để ghi.

Mọi giờ hiển thị và nhập là giờ Việt Nam (UTC+7), kể cả khi thiết bị dùng múi giờ khác. Lịch tuần bắt đầu/kết thúc trong cùng ngày, chính xác đến phút; buổi dài tối đa 12 giờ. Có thể sinh tối đa 93 ngày/lần trong 366 ngày tới. Chỉ sinh các vị trí chưa qua giờ, trong thời gian của lớp và hiệu lực quy tắc.

**Sinh lại giữ nguyên buổi đã có**, kể cả buổi đã đổi riêng sang ngày/tuần khác hoặc bị hủy. Mỗi quy tắc có một vị trí gốc trong mỗi tuần ISO. Muốn thêm buổi ngoài lịch, tạo buổi riêng.

## Xem lịch và tạo buổi riêng

Vào **Lịch dạy**, chọn lớp/trạng thái và chuyển tuần bằng **Tuần trước**, **Tuần này**, **Tuần sau** hoặc ô ngày. Lịch sắp theo giờ bắt đầu, có phân trang khi nhiều buổi. Bộ lọc bổ sung nằm trong **Bộ lọc** trên mobile. **Lịch tuần của lớp** dẫn đến cấu hình lịch lặp.

Chọn **Thêm buổi học**, chọn lớp đang dạy, nhập thời gian, tên, địa điểm và kế hoạch riêng nếu cần. Tên để trống dùng tên lớp. Xem trước rồi xác nhận tạo. Kế hoạch riêng chỉ cô xem; tên, thời gian, địa điểm và lý do hủy được chia sẻ với gia đình đủ quyền.

Dashboard hiển thị số buổi và danh sách tối đa sáu buổi hôm nay theo lớp đang chọn. Không gồm buổi hủy; đi qua giờ theo lịch chưa có nghĩa bé đã được điểm danh hoặc buổi đã hoàn thành.

## Trùng giờ

Xem trước kiểm tra cả buổi đã có và các buổi cùng được sinh trong một đợt. Hai buổi nối tiếp sát nhau không bị coi trùng. Nếu có trùng, cô xem danh sách và chọn **Tôi đã xem các buổi trùng giờ và xác nhận lưu ngoại lệ** trước khi xác nhận lưu.

Thay đổi thông tin trên form sẽ bỏ xác nhận cũ. Nếu lịch thay đổi trong lúc cô đang xem trước, hệ thống yêu cầu xem lại khi danh sách xung đột khác đi; không tự chấp nhận xung đột mới. Giờ/tên đang nhập được giữ khi yêu cầu lưu lỗi.

## Đổi một buổi hoặc đổi lịch tuần

- Mở buổi → **Đổi buổi học**, nhập giờ/nội dung và lý do, xem trước rồi xác nhận. Buổi trở thành ngoại lệ; không đổi lịch lặp của các tuần khác. Không đổi buổi đã bắt đầu, bị hủy, đã hoàn thành hoặc đã có danh sách điểm danh; không chuyển buổi sang lớp khác.
- Trong **Lịch tuần**, chọn **Chỉnh lịch** và ngày áp dụng mới. Chỉ đổi các buổi tương lai đã sinh từ ngày đó; giữ buổi trước ngày áp dụng, quá khứ, ngoại lệ, đã hủy hoặc được bảo vệ bởi danh sách điểm danh.
- Đổi thứ sẽ chuyển buổi đủ điều kiện sang thứ mới trong cùng tuần gốc. Buổi nằm ngoài ngày hiệu lực/thời gian lớp hoặc rơi vào giờ đã qua sẽ được hủy với lý do, không sửa lại quá khứ.
- Bỏ chọn **Đang áp dụng lịch tuần này** sẽ hủy các buổi tương lai đủ điều kiện từ ngày áp dụng. Các ngoại lệ được giữ. Muốn hủy ngoại lệ, mở từng buổi để xử lý.
- Thay đổi quy tắc không tự tạo các tuần chưa có buổi; dùng bước **Sinh buổi học** cho khoảng mới. Thông tin quy tắc cũ và thời gian cũ được giữ trong lịch sử quản lý.

## Hủy và xem lịch sử

Mở buổi → **Hủy buổi học** → nhập lý do chia sẻ với gia đình → **Xác nhận hủy buổi**. Giữ thời gian/kế hoạch cũ, trạng thái hủy và lịch sử; sinh lịch lại không tạo lại buổi đó. Có thể hủy một buổi quá khứ để sửa sai có lý do. Lớp đã lưu trữ cần được khôi phục trước khi hủy buổi.

Phần **Lịch sử thay đổi** của buổi cho xem lần tạo, điều chỉnh/hủy, thời điểm, lý do và giờ trước/sau. Mỗi lần sửa kiểm tra phiên bản; màn hình cũ phải tải lại để sửa tiếp.

## Gia đình xem lịch

Trong hồ sơ bé, mở **Lịch học của bé** hoặc dùng mục **Lịch học** ở điều hướng gia đình. Đổi bé giữ màn hình lịch và tải dữ liệu của bé mới. Bộ chọn lớp xuất hiện khi có nhiều lớp hoặc đang dùng bộ lọc lớp.

Gia đình cần tài khoản đã xác minh và liên kết với bé còn hiệu lực. Lịch theo quyền lớp hiện tại: đang học được xem lịch từ lúc tham gia; lớp và thành viên đã hoàn thành chỉ xem các buổi đến thời điểm kết thúc. Rời lớp ẩn lịch của lớp đó; thu hồi liên kết chặn cả lịch của bé. Đây là lịch dự kiến, chưa phải danh sách điểm danh theo từng thời kỳ.

## Phần tiếp theo

TC-018 đã bổ sung [điểm danh theo buổi](11-diem-danh.md), hoàn thành/mở lại và lịch sử của bé. Học bù tạm hoãn theo người dùng. Tự gửi thông báo đổi lịch, đồng bộ lịch ngoài và tính học phí tiếp tục theo backlog.
