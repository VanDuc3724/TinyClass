# TinyClass — Sản phẩm của bé và phản hồi của cô

Áp dụng cho TC-015/016, migration V8. Giao diện dùng bộ màu và thành phần trong [Design.md](../frontend/Design.md). Kho đang hoạt động là LOCAL; Google đăng nhập thật và Google Drive vẫn chưa cấu hình/tích hợp.

## Chuẩn bị yêu cầu

1. Giáo viên soạn bài, chọn **Giáo viên duyệt sản phẩm** và những loại trả lời được nhận: chữ, ảnh, âm thanh hoặc video.
2. Xuất bản bài, tạo lần giao cho lớp/bé, kiểm tra yêu cầu từng bài rồi xuất bản lần giao. Phụ huynh cần tài khoản đã xác minh và liên kết hợp lệ với bé.
3. Trong chi tiết lần giao, mỗi người nhận có **Xem tiến độ**; hàng đợi nằm tại menu **Phản hồi**.

`REFERENCE` giữ luồng chỉ tham khảo. `PARENT_CONFIRM` vẫn hoàn thành bằng xác nhận của gia đình; hai cách này không dùng biểu mẫu nộp sản phẩm.

Cách hoàn thành được chụp vào lần giao. Đổi mặc định của bài gốc không đổi các lần giao đã xuất bản; tạo lần giao mới nếu muốn yêu cầu sản phẩm cho một bài đã giao theo cách khác.

## Gia đình lưu nháp và gửi

1. Chọn đúng bé → **Góc học của bé** → mở bài cần cô duyệt.
2. Trong **Sản phẩm của bé**, chọn **Tạo bản nháp sản phẩm**, nhập chữ và chọn tệp đúng yêu cầu.
3. Chọn **Tải tệp lên và lưu nháp** khi có tệp; hoặc **Lưu bản nháp** để tiếp tục sau. Chỉ hiện “đã lưu” sau khi API thành công.
4. Kiểm tra rồi chọn **Gửi sản phẩm cho cô**. Lưu nháp chưa gửi; gửi chưa tự hoàn thành bài. Lượt đã gửi được giữ nguyên, không sửa trực tiếp.

Mỗi người giám hộ có nháp riêng trong một vòng học. Người khác còn liên kết với bé được xem lịch sử, nhưng không sửa nháp của tác giả. Một bé/bài được giao chỉ có tối đa một lượt đang chờ duyệt, kể cả khi hai người cùng gửi.

Giới hạn: tối đa **5 tệp/tổng 250 MiB** cho một sản phẩm; ảnh 10 MiB, âm thanh 20 MiB, video 200 MiB mỗi tệp. PDF không phải loại trả lời sản phẩm ở phiên bản này. Backend kiểm tra nội dung/MIME và ngữ cảnh bé/bài/người upload, không chỉ đuôi tệp. Quota của kho giáo viên tính cả tệp gia đình.

Upload lỗi giữ chữ, tệp đã lưu và những tệp còn chờ để thử lại. Có thể bỏ tệp rồi lưu nháp; byte rời chưa tự được dọn. Chọn tệp nhưng chưa tải lên sẽ chưa gửi được sản phẩm. Gửi sau hạn gợi ý vẫn được nếu còn quyền, kèm nhãn gửi muộn.

## Giáo viên phản hồi

Menu **Phản hồi** mặc định hiển thị các lượt **Chờ cô duyệt**; lọc theo trạng thái, lớp, bé và bài. Nháp gia đình không nằm trong hàng đợi giáo viên.

- **Yêu cầu bổ sung:** cần nhận xét bằng chữ giải thích; có thể kèm âm thanh. Gia đình thấy phản hồi và tạo lượt gửi tiếp theo. Lượt cũ được giữ.
- **Chấp nhận sản phẩm:** ghi nhận hoàn thành bài và thời điểm cô chấp nhận. Nhận xét/âm thanh được chia sẻ với gia đình theo sản phẩm đó.
- Tệp âm thanh phản hồi dùng MP3/WAV/OGG, tối đa 20 MiB. Chọn tệp rồi tải lên trước khi lưu phản hồi.

Trang chi tiết sản phẩm cho xem/tải tệp trong đúng ngữ cảnh được cấp quyền. Hàng đợi và ô **Sản phẩm chờ duyệt** trên dashboard dùng dữ liệu thật, theo lớp đang chọn; không tính các bản nháp.

## Mở lại yêu cầu

Trong lần giao → **Xem tiến độ** của bé → **Mở lại yêu cầu**, nhập lý do và xác nhận **Mở vòng học mới**. Chỉ mở lại bài đã hoàn thành khi bé còn quyền; với lần giao theo lớp, lớp phải còn đang dạy.

Tiến độ về **Đã mở**, vòng học tăng lên, mốc hoàn thành/xác nhận của vòng hiện tại được xóa; lịch sử và mốc cũ vẫn được lưu. Lượt được chấp nhận ở vòng trước không tự hoàn thành vòng mới. `PARENT_CONFIRM` cần gia đình xác nhận lại; `TEACHER_REVIEW` cần một lượt mới được cô chấp nhận.

## Lịch sử và quyền

- Gia đình vào **Sản phẩm & phản hồi** trong hồ sơ bé, hoặc **Tất cả sản phẩm của bé** trong bài. Lịch sử gồm các lượt, tác giả, phản hồi và vòng học.
- Rời lớp/thu hồi lần giao chặn xem bài gốc và gửi mới. Sản phẩm/phản hồi riêng đã lưu vẫn đọc được khi liên kết gia đình còn hiệu lực; lịch sử không cấp lại quyền bài gốc.
- Thu hồi liên kết phụ huynh chặn cả lịch sử và yêu cầu xem/tải tệp của bé. Refresh sau lỗi hết quyền bỏ nội dung cũ khỏi màn hình.
- Lớp đã kết thúc chỉ xem lại, không upload/gửi mới. Giáo viên vẫn có thể xử lý lượt đã được gửi trước đó, nhưng không mở vòng mới khi thiếu quyền nhận hiện tại.
- Backend kiểm tra từng request, kể cả Range cho media. Byte đã được tải hoặc buffer trước khi thu hồi không thể thu lại.

[OpenAPI](spec/openapi.yaml) mô tả route/DTO và mã lỗi hiện có. [Báo cáo nghiệm thu](verification/2026-11-02-submissions.md) ghi kiểm thử và ảnh minh chứng. Lịch dạy đã có [hướng dẫn riêng](10-lich-day.md); điểm danh/bù, nhận xét định kỳ, học phí và thông báo tự động tiếp tục theo backlog.
